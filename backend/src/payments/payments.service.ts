import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PurchasesService } from "../purchases/purchases.service";
import { OrdersService } from "../orders/orders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentProvidersService } from "./payment-providers.service";
import {
  CheckoutContext,
  CheckoutResult,
} from "./providers/payment-provider.interface";

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private purchases: PurchasesService,
    private orders: OrdersService,
    private notifications: NotificationsService,
    private providers: PaymentProvidersService,
  ) {}

  // Gateways the client may choose from at checkout.
  availableGateways() {
    return { providers: this.providers.enabledNames() };
  }

  // Record the client's chosen gateway on the payment and hand back a URL the
  // browser can open. The actual provider redirect/HTML is built lazily in
  // buildRedirect so the gateway API is only called when the user proceeds.
  async checkout(paymentId: string, gateway?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const provider = this.providers.get(gateway);
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { gateway: provider.name },
    });

    const apiBase = process.env.PUBLIC_API_URL || "http://localhost:4000/api";
    return { url: `${apiBase}/payments/redirect/${paymentId}` };
  }

  // Build the gateway redirect (or self-submitting form) for a payment using the
  // gateway previously chosen in checkout().
  async buildRedirect(paymentId: string): Promise<CheckoutResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        purchase: { include: { package: true } },
        order: { include: { book: true, bundle: true, plan: true } },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const provider = this.providers.get(payment.gateway);
    const web = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
    const apiBase = process.env.PUBLIC_API_URL || "http://localhost:4000/api";

    const ctx: CheckoutContext = {
      paymentId: payment.id,
      purchaseId: payment.purchaseId,
      amount: payment.amount,
      currency: payment.currency,
      itemName:
        payment.order?.book?.title ||
        payment.order?.bundle?.title ||
        payment.order?.plan?.name ||
        payment.purchase?.package?.name ||
        "Consultation",
      customerEmail: payment.user.email,
      customerName: payment.user.name,
      customerPhone: payment.user.phone || undefined,
      successUrl: `${web}/payment/success?ref=${payment.id}`,
      failureUrl: `${web}/payment/cancel?ref=${payment.id}`,
      notifyUrl: `${apiBase}/payments/webhook/${provider.name}`,
    };
    return provider.createCheckout(ctx);
  }

  // Mark a payment paid + activate its purchase. Idempotent.
  async markPaid(paymentId: string, reference?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.PAID) return payment;

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, reference },
    });
    if (payment.purchaseId) {
      await this.purchases.activate(payment.purchaseId);
    }
    // Digital-product orders (books, bundles, subscriptions) grant access here.
    if (payment.orderId) {
      await this.orders.fulfill(payment.orderId);
    }
    await this.notifications.create(payment.userId, {
      type: "PAYMENT_CONFIRMED",
      title: "Payment confirmed",
      body: `Your payment of ${payment.currency} ${payment.amount} was received.`,
      email: true,
    });
    return updated;
  }

  // Mark a payment failed. Idempotent; never downgrades a PAID payment.
  async markFailed(paymentId: string, reference?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.PAID) return payment;
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, reference },
    });
  }

  // Single entry point for every gateway webhook. The provider parses + verifies
  // the payload and tells us which payment to update and to what status. The
  // webhook is the source of truth for activation.
  async handleWebhook(
    gateway: string,
    payload: Record<string, any>,
    headers: Record<string, string>,
    rawBody?: string,
  ) {
    const provider = this.providers.get(gateway);
    const result = await provider.handleWebhook(payload, headers, rawBody);
    if (!result.paymentId) return { ok: false };
    if (result.status === "PAID") {
      await this.markPaid(result.paymentId, result.reference);
    } else if (result.status === "FAILED") {
      await this.markFailed(result.paymentId, result.reference);
    }
    return { ok: true, status: result.status };
  }

  listForUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { purchase: { include: { package: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listAll() {
    return this.prisma.payment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        purchase: { include: { package: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
