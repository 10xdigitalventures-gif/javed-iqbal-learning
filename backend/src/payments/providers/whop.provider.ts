import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// Whop provider.
//
// Mirrors the proven flow from our WooCommerce Whop plugin:
//   1. POST /api/v1/checkout_configurations with a one_time plan priced in USD.
//   2. Redirect the buyer to https://whop.com/checkout/<plan_id>.
//   3. Confirm via the payment.succeeded webhook, verified with the Standard
//      Webhooks scheme (webhook-id / webhook-timestamp / webhook-signature).
//
// Whop charges in USD but our catalogue is priced in PKR, so the amount is
// converted to USD using WHOP_USD_RATE (PKR per USD) plus an optional
// WHOP_FEE_PERCENT surcharge — exactly like the plugin.
@Injectable()
export class WhopProvider implements PaymentProvider {
  readonly name = "whop";
  private readonly logger = new Logger("WhopProvider");

  isEnabled() {
    return Boolean(process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID);
  }

  private apiBase() {
    return process.env.WHOP_API_BASE || "https://api.whop.com";
  }

  // PKR -> USD using the configured rate + optional percentage fee. Amounts that
  // are already in USD are passed through unchanged.
  private toUsd(amount: number, currency: string): number {
    if ((currency || "").toUpperCase() === "USD") {
      return Math.round(amount * 100) / 100;
    }
    const rate = Number(process.env.WHOP_USD_RATE) || 280;
    const feePercent = Number(process.env.WHOP_FEE_PERCENT) || 0;
    const withFee = amount + amount * (feePercent / 100);
    const usd = withFee / (rate > 0 ? rate : 280);
    return Math.max(0.01, Math.round(usd * 100) / 100);
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const usdAmount = this.toUsd(ctx.amount, ctx.currency);

    const res = await fetch(
      `${this.apiBase()}/api/v1/checkout_configurations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currency: "usd",
          plan: {
            initial_price: usdAmount,
            plan_type: "one_time",
            company_id: process.env.WHOP_COMPANY_ID,
            currency: "usd",
          },
          // Round-tripped to the webhook so we can map the Whop payment back to
          // our Payment record.
          metadata: {
            paymentId: ctx.paymentId,
            purchaseId: ctx.purchaseId,
            itemName: ctx.itemName,
            original_amount: String(ctx.amount),
            original_currency: ctx.currency,
            usd_charged: String(usdAmount),
          },
        }),
      },
    );

    const raw = await res.text();
    let json: any = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    // Preferred: a checkout configuration / plan id we can send the buyer to.
    const planId = json?.plan?.id || json?.plan_id || "";
    if (res.ok && planId) {
      return { redirectUrl: `https://whop.com/checkout/${planId}` };
    }

    // Some Whop responses return a ready-made hosted purchase URL directly.
    const directUrl =
      json?.purchase_url ||
      json?.checkout_url ||
      json?.url ||
      json?.plan?.purchase_url;
    if (res.ok && directUrl) {
      return { redirectUrl: directUrl };
    }

    this.logger.error(
      `Whop checkout failed (HTTP ${res.status}): ${raw || "<empty body>"}`,
    );
    throw new Error("Could not start Whop checkout");
  }

  async handleWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
    rawBody?: string,
  ): Promise<WebhookResult> {
    if (!this.verifySignature(headers, rawBody)) {
      this.logger.warn("Whop webhook signature verification failed");
      return { status: "FAILED" };
    }
    const type = payload.type || payload.action || payload.event;
    const data = payload.data || payload;
    const paymentId = data?.metadata?.paymentId || payload?.metadata?.paymentId;
    const reference = data?.id || payload?.id;
    const status = type === "payment.succeeded" ? "PAID" : "PENDING";
    return { paymentId, status, reference };
  }

  // Standard Webhooks verification (same scheme the WooCommerce plugin uses):
  //   signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"
  //   signature      = base64( HMAC_SHA256(key, signed_content) )
  // When the secret is prefixed "whsec_", the remainder is base64-decoded to the
  // signing key; otherwise the raw secret bytes are used.
  private verifySignature(
    headers: Record<string, string>,
    rawBody?: string,
  ): boolean {
    const secret = process.env.WHOP_WEBHOOK_SECRET;
    // No secret configured -> cannot verify -> accept (dev only).
    if (!secret) return true;
    if (!rawBody) return false;

    const get = (name: string) =>
      headers[name] ||
      headers[name.toLowerCase()] ||
      headers[name.toUpperCase()];
    const id = get("webhook-id");
    const timestamp = get("webhook-timestamp");
    const sigHeader = get("webhook-signature");
    if (!id || !timestamp || !sigHeader) return false;

    // Replay protection: reject timestamps older than 5 minutes.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const key = secret.startsWith("whsec_")
      ? Buffer.from(secret.slice(6), "base64")
      : Buffer.from(secret);
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", key)
      .update(signedContent)
      .digest("base64");

    // The header may contain space-separated, comma-versioned signatures
    // (e.g. "v1,<sig> v1a,<sig>").
    for (const versioned of sigHeader.split(" ")) {
      const parts = versioned.split(",");
      const sig = parts.length === 2 ? parts[1] : parts[0];
      try {
        const a = Buffer.from(expected);
        const b = Buffer.from(sig);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      } catch {
        // try next signature
      }
    }
    return false;
  }
}
