import { Injectable } from "@nestjs/common";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// Development gateway. Always enabled so the platform stays usable without any
// real credentials. The hosted "checkout" is a local endpoint that immediately
// confirms the payment and redirects back to the success page.
@Injectable()
export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  isEnabled() {
    return true;
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const apiBase = process.env.PUBLIC_API_URL || "http://localhost:4000/api";
    return {
      mock: true,
      redirectUrl: `${apiBase}/payments/mock-checkout/${ctx.paymentId}`,
    };
  }

  async handleWebhook(
    payload: Record<string, any>,
  ): Promise<WebhookResult> {
    const paymentId = payload.paymentId || payload.m_payment_id;
    return { paymentId, status: "PAID", reference: "MOCK-" + Date.now() };
  }
}
