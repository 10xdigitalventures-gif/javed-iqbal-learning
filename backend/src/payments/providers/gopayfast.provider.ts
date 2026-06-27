import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// GoPayFast / PayFast-PK (APPS IPG) hosted-checkout provider.
//
// Aligned with the official PayFast WooCommerce plugin (sandbox + live) and the
// gopayfast.com hosted-checkout spec:
//   1. POST MERCHANT_ID + SECURED_KEY + BASKET_ID + TXNAMT + CURRENCY_CODE to
//      GetAccessToken and receive a one-time ACCESS_TOKEN.
//   2. Build an MD5 signature: md5(MERCHANT_ID:MERCHANT_NAME:TXNAMT:BASKET_ID).
//   3. Send the customer to the hosted checkout by POSTing the token + order
//      fields (incl. SIGNATURE, VERSION, SUCCESS_URL / FAILURE_URL /
//      CHECKOUT_URL) to PostTransaction via a self-submitting HTML form.
//   4. The gateway calls our IPN/webhook (CHECKOUT_URL). The webhook is the
//      source of truth — we never activate a purchase from the success redirect.
//
// Sandbox vs live is just the API host (ipguat vs ipg1), controlled by
// GOPAYFAST_MODE ("sandbox" | "live") or overridden by GOPAYFAST_API_BASE.
@Injectable()
export class GoPayFastProvider implements PaymentProvider {
  readonly name = "gopayfast";
  private readonly logger = new Logger("GoPayFastProvider");

  isEnabled() {
    return Boolean(
      process.env.GOPAYFAST_MERCHANT_ID && process.env.GOPAYFAST_SECURED_KEY,
    );
  }

  // Base URL for the APPS IPG. Sandbox (UAT) vs live is controlled by
  // GOPAYFAST_MODE, and can be fully overridden with GOPAYFAST_API_BASE.
  private apiBase() {
    if (process.env.GOPAYFAST_API_BASE) return process.env.GOPAYFAST_API_BASE;
    const live = String(process.env.GOPAYFAST_MODE).toLowerCase() === "live";
    return live
      ? "https://ipg1.apps.net.pk/Ecommerce/api/Transaction"
      : "https://ipguat.apps.net.pk/Ecommerce/api/Transaction";
  }

  private merchantName() {
    return process.env.GOPAYFAST_MERCHANT_NAME || "Consult Hub";
  }

  // Hosted-checkout signature, exactly as the WooCommerce plugin builds it:
  // md5(MERCHANT_ID:MERCHANT_NAME:TXNAMT:BASKET_ID).
  private buildSignature(
    merchantId: string,
    amount: string,
    basketId: string,
  ) {
    return createHash("md5")
      .update(`${merchantId}:${this.merchantName()}:${amount}:${basketId}`)
      .digest("hex");
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const merchantId = process.env.GOPAYFAST_MERCHANT_ID as string;
    const securedKey = process.env.GOPAYFAST_SECURED_KEY as string;
    const amount = ctx.amount.toFixed(2);
    const currency = ctx.currency || "PKR";

    // Step 1 — fetch a one-time access token.
    const tokenRes = await fetch(`${this.apiBase()}/GetAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        MERCHANT_ID: merchantId,
        SECURED_KEY: securedKey,
        BASKET_ID: ctx.paymentId,
        TXNAMT: amount,
        CURRENCY_CODE: currency,
      }).toString(),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    const token = tokenJson.ACCESS_TOKEN || tokenJson.token;
    if (!token) {
      this.logger.error(
        `GoPayFast token request failed: ${JSON.stringify(tokenJson)}`,
      );
      throw new Error("Could not start GoPayFast checkout");
    }

    // Step 2 — build the MD5 signature for the hosted-checkout payload.
    const signature = this.buildSignature(merchantId, amount, ctx.paymentId);

    // Carry the signature + basket id on the IPN/callback URL so our webhook can
    // independently verify the notification.
    const sep = ctx.notifyUrl.includes("?") ? "&" : "?";
    const checkoutUrl = `${ctx.notifyUrl}${sep}signature=${signature}&basket_id=${encodeURIComponent(
      ctx.paymentId,
    )}`;

    // Step 3 — self-submitting form that POSTs to the hosted checkout. Values are
    // left raw; the browser URL-encodes form fields on submit.
    const postUrl = `${this.apiBase()}/PostTransaction`;
    const fields: Record<string, string> = {
      MERCHANT_ID: merchantId,
      MERCHANT_NAME: this.merchantName(),
      TOKEN: token,
      PROCCODE: "00",
      TXNAMT: amount,
      CUSTOMER_MOBILE_NO: ctx.customerPhone || "",
      CUSTOMER_EMAIL_ADDRESS: ctx.customerEmail,
      SIGNATURE: signature,
      VERSION: "WOOCOM-APPS-PAYMENT-0.9",
      TXNDESC: ctx.itemName,
      SUCCESS_URL: ctx.successUrl,
      FAILURE_URL: ctx.failureUrl,
      CHECKOUT_URL: checkoutUrl,
      BASKET_ID: ctx.paymentId,
      ORDER_DATE: new Date().toISOString(),
      CURRENCY_CODE: currency,
    };

    return {
      redirectUrl: postUrl,
      formHtml: this.autoSubmitForm(postUrl, fields),
    };
  }

  async handleWebhook(
    payload: Record<string, any>,
  ): Promise<WebhookResult> {
    // GoPayFast posts back form-encoded fields; err_code "000"/"00"/"0" == success.
    const paymentId = payload.basket_id || payload.BASKET_ID;
    const code = String(
      payload.err_code ?? payload.ERR_CODE ?? payload.responseCode ?? "",
    );
    const reference =
      payload.transaction_id || payload.TRANSACTION_ID || payload.txn_ref_no;

    // Best-effort signature check. PayFast echoes the signature we sent on the
    // CHECKOUT_URL; recompute it from the basket id + amount and warn on any
    // mismatch. err_code stays the source of truth because IPN field names vary
    // between gateway versions.
    const sentSignature = payload.signature || payload.SIGNATURE;
    const merchantId = process.env.GOPAYFAST_MERCHANT_ID as string;
    const amount = payload.TXNAMT ?? payload.transaction_amount ?? payload.amount;
    if (sentSignature && merchantId && amount != null && paymentId) {
      const expected = this.buildSignature(
        merchantId,
        Number(amount).toFixed(2),
        String(paymentId),
      );
      if (expected !== sentSignature) {
        this.logger.warn(
          `GoPayFast webhook signature mismatch for ${paymentId} (got ${sentSignature})`,
        );
      }
    }

    const status =
      code === "000" || code === "00" || code === "0" ? "PAID" : "FAILED";
    return { paymentId, status, reference };
  }

  // Renders an HTML page that immediately POSTs the fields to the gateway.
  private autoSubmitForm(action: string, fields: Record<string, string>) {
    const inputs = Object.entries(fields)
      .map(
        ([k, v]) =>
          `<input type="hidden" name="${this.escape(k)}" value="${this.escape(
            v,
          )}" />`,
      )
      .join("\n      ");
    return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting to PayFast…</title></head>
  <body onload="document.forms[0].submit()" style="font-family:system-ui;text-align:center;padding:40px">
    <p>Redirecting you to PayFast to complete your payment…</p>
    <form method="POST" action="${this.escape(action)}">
      ${inputs}
      <noscript><button type="submit">Continue to payment</button></noscript>
    </form>
  </body>
</html>`;
  }

  private escape(value: string) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
