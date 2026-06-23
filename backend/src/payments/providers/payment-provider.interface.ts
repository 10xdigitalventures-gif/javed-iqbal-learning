// Common contract every payment gateway implements. The platform talks only to
// this interface, so adding a new gateway means adding one provider class.
//
// Conceptually:
//   interface PaymentProvider {
//     createCheckout(purchase): Promise<{ redirectUrl }>;
//     handleWebhook(payload, headers): Promise<{ purchaseId, status }>;
//   }
//
// We pass a small, gateway-agnostic CheckoutContext (built from the Payment +
// Purchase + User) instead of the raw Prisma row so providers stay decoupled
// from the database schema.

export type PaymentStatusResult = "PAID" | "FAILED" | "PENDING";

export interface CheckoutContext {
  /** Our internal Payment id — used as the gateway basket / reference id. */
  paymentId: string;
  /** The purchase being paid for (null only in unusual states). */
  purchaseId: string | null;
  amount: number;
  currency: string;
  itemName: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  /** Where the gateway should send the user after success / failure. */
  successUrl: string;
  failureUrl: string;
  /** Server-to-server IPN / webhook URL for this gateway. */
  notifyUrl: string;
}

export interface CheckoutResult {
  /** URL the browser should be sent to in order to complete payment. */
  redirectUrl: string;
  /**
   * Optional self-submitting HTML form. Some gateways (e.g. GoPayFast) require a
   * POST to start the hosted checkout; when present, the API renders this page
   * instead of issuing a plain redirect.
   */
  formHtml?: string;
  /** True when this is the dev mock rather than a real gateway. */
  mock?: boolean;
}

export interface WebhookResult {
  /** Our internal Payment id resolved from the webhook payload. */
  paymentId?: string;
  status: PaymentStatusResult;
  /** Gateway-side transaction reference, stored for auditing. */
  reference?: string;
}

export interface PaymentProvider {
  /** Stable key used in PAYMENT_PROVIDERS and Payment.gateway (e.g. "gopayfast"). */
  readonly name: string;
  /** True when the required credentials/config for this provider are present. */
  isEnabled(): boolean;
  createCheckout(ctx: CheckoutContext): Promise<CheckoutResult>;
  handleWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
    rawBody?: string,
  ): Promise<WebhookResult>;
}
