import { Injectable } from "@nestjs/common";
import {
  CheckoutContext,
  CheckoutResult,
  PaymentProvider,
  WebhookResult,
} from "./payment-provider.interface";

// Manual offline bank-transfer "gateway". There is no hosted checkout: the user
// transfers the amount to our bank account and submits proof (receipt + txn id)
// in-app. The payment stays PENDING until an admin verifies it, so this
// provider never confirms via webhook. createCheckout simply points web users
// to the in-app bank-transfer instructions page.
@Injectable()
export class BankTransferProvider implements PaymentProvider {
  readonly name = "bank_transfer";

  // OFF by default (10X app direction: app pays via card/PayFast only,
  // instant access). The provider stays in code and is not removed — an
  // admin can re-enable manual bank transfer by setting
  // BANK_TRANSFER_ENABLED=true.
  isEnabled() {
    return process.env.BANK_TRANSFER_ENABLED === "true";
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const web = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
    return {
      redirectUrl: web + "/payment/bank-transfer?ref=" + ctx.paymentId,
    };
  }

  async handleWebhook(): Promise<WebhookResult> {
    // Bank transfers are confirmed manually by an admin, never via webhook.
    return { status: "PENDING" };
  }
}
