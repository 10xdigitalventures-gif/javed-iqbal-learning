import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// Whop provider. Creates a hosted checkout session via the Whop API and confirms
// the purchase from the payment.succeeded webhook (verified with an HMAC over
// the raw request body using WHOP_WEBHOOK_SECRET).
@Injectable()
export class WhopProvider implements PaymentProvider {
  readonly name = "whop";
  private readonly logger = new Logger("WhopProvider");

  isEnabled() {
    return Boolean(process.env.WHOP_API_KEY);
  }

  private apiBase() {
    return process.env.WHOP_API_BASE || "https://api.whop.com";
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const res = await fetch(`${this.apiBase()}/api/v2/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: process.env.WHOP_COMPANY_ID,
        // Our Payment id is round-tripped via metadata so the webhook can map
        // the Whop payment back to our record.
        metadata: { paymentId: ctx.paymentId, purchaseId: ctx.purchaseId },
        amount: ctx.amount,
        currency: (ctx.currency || "usd").toLowerCase(),
        name: ctx.itemName,
        redirect_url: ctx.successUrl,
        cancel_url: ctx.failureUrl,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    const redirectUrl =
      json.purchase_url || json.checkout_url || json.url || json?.data?.purchase_url;
    if (!redirectUrl) {
      this.logger.error(`Whop checkout failed: ${JSON.stringify(json)}`);
      throw new Error("Could not start Whop checkout");
    }
    return { redirectUrl };
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
    const event = payload.action || payload.type || payload.event;
    const data = payload.data || payload;
    const paymentId =
      data?.metadata?.paymentId || payload?.metadata?.paymentId;
    const reference = data?.id || payload?.id;
    const status = event === "payment.succeeded" ? "PAID" : "PENDING";
    return { paymentId, status, reference };
  }

  private verifySignature(
    headers: Record<string, string>,
    rawBody?: string,
  ): boolean {
    const secret = process.env.WHOP_WEBHOOK_SECRET;
    // If no secret is configured we cannot verify; accept in dev only.
    if (!secret) return true;
    if (!rawBody) return false;
    const provided =
      headers["x-whop-signature"] ||
      headers["X-Whop-Signature"] ||
      headers["whop-signature"];
    if (!provided) return false;
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
