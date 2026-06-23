import { Injectable, Logger } from "@nestjs/common";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// GoPayFast / PayFast-PK (APPS IPG) hosted-checkout provider.
//
// Flow (per gopayfast.com docs):
//   1. POST MERCHANT_ID + SECURED_KEY + BASKET_ID + TXNAMT to GetAccessToken
//      and receive a one-time ACCESS_TOKEN.
//   2. Send the customer to the hosted checkout by POSTing the token + order
//      fields (incl. SUCCESS_URL / FAILURE_URL / CHECKOUT_URL) to
//      PostTransaction. We do this with a self-submitting HTML form.
//   3. The gateway calls our IPN/webhook (CHECKOUT_URL). The webhook is the
//      source of truth — we never activate a purchase from the success redirect.
@Injectable()
export class GoPayFastProvider implements PaymentProvider {
  readonly name = "gopayfast";
  private readonly logger = new Logger("GoPayFastProvider");

  isEnabled() {
    return Boolean(
      process.env.GOPAYFAST_MERCHANT_ID && process.env.GOPAYFAST_SECURED_KEY,
    );
  }

  // Base URL for the APPS IPG. Sandbox vs live is controlled by GOPAYFAST_MODE,
  // and can be fully overridden with GOPAYFAST_API_BASE.
  private apiBase() {
    if (process.env.GOPAYFAST_API_BASE) return process.env.GOPAYFAST_API_BASE;
    const live = String(process.env.GOPAYFAST_MODE).toLowerCase() === "live";
    return live
      ? "https://ipg1.apps.net.pk/Ecommerce/api/Transaction"
      : "https://ipguat.apps.net.pk/Ecommerce/api/Transaction";
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const merchantId = process.env.GOPAYFAST_MERCHANT_ID as string;
    const securedKey = process.env.GOPAYFAST_SECURED_KEY as string;
    const amount = ctx.amount.toFixed(2);

    // Step 1 — fetch a one-time access token.
    const tokenRes = await fetch(`${this.apiBase()}/GetAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        MERCHANT_ID: merchantId,
        SECURED_KEY: securedKey,
        BASKET_ID: ctx.paymentId,
        TXNAMT: amount,
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

    // Step 2 — build a self-submitting form that POSTs to the hosted checkout.
    const postUrl = `${this.apiBase()}/PostTransaction`;
    const fields: Record<string, string> = {
      MERCHANT_ID: merchantId,
      MERCHANT_NAME: process.env.GOPAYFAST_MERCHANT_NAME || "Consult Hub",
      TOKEN: token,
      PROCCODE: "00",
      TXNAMT: amount,
      CUSTOMER_MOBILE_NO: ctx.customerPhone || "",
      CUSTOMER_EMAIL_ADDRESS: ctx.customerEmail,
      SIGNATURE: token,
      VERSION: "MERCHANT-CART-0.1",
      TXNDESC: ctx.itemName,
      SUCCESS_URL: ctx.successUrl,
      FAILURE_URL: ctx.failureUrl,
      CHECKOUT_URL: ctx.notifyUrl,
      BASKET_ID: ctx.paymentId,
      ORDER_DATE: new Date().toISOString(),
      CURRENCY_CODE: ctx.currency || "PKR",
    };

    return { redirectUrl: postUrl, formHtml: this.autoSubmitForm(postUrl, fields) };
  }

  async handleWebhook(
    payload: Record<string, any>,
  ): Promise<WebhookResult> {
    // GoPayFast posts back form-encoded fields; err_code "000"/"00" == success.
    const paymentId = payload.basket_id || payload.BASKET_ID;
    const code = String(
      payload.err_code ?? payload.ERR_CODE ?? payload.responseCode ?? "",
    );
    const reference =
      payload.transaction_id || payload.TRANSACTION_ID || payload.txn_ref_no;
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
  <head><meta charset="utf-8" /><title>Redirecting to GoPayFast…</title></head>
  <body onload="document.forms[0].submit()" style="font-family:system-ui;text-align:center;padding:40px">
    <p>Redirecting you to GoPayFast to complete your payment…</p>
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
