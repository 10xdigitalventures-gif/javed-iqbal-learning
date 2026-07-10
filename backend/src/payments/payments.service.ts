import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HardCopyOrderStatus, PaymentStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Paginated, parsePagination, buildOrderBy } from "../common/list-query";
import { PurchasesService } from "../purchases/purchases.service";
import { OrdersService } from "../orders/orders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentProvidersService } from "./payment-providers.service";
import { GhlSyncService } from "../ghl-sync/ghl-sync.service";
import { AttributionService } from "../attribution/attribution.service";
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
    private ghl: GhlSyncService,
    private attribution: AttributionService,
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
        order: {
          include: { book: true, bundle: true, plan: true, course: true },
        },
        hardCopy: { include: { book: true } },
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
        payment.order?.course?.title ||
        payment.purchase?.package?.name ||
        payment.hardCopy?.book?.title ||
        (payment.hardCopyOrderId ? "Hard copy order" : "") ||
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

    // Assign trackable document numbers. invoiceNo is normally set at creation;
    // guarantee one here, and mint a unique receiptNo the first time a payment
    // is marked PAID so every receipt can be tracked/looked up.
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const data: {
      status: PaymentStatus;
      reference?: string;
      invoiceNo?: string;
      receiptNo?: string;
    } = { status: PaymentStatus.PAID, reference };
    if (!payment.invoiceNo) data.invoiceNo = "INV-" + stamp;
    if (!payment.receiptNo) data.receiptNo = "RCPT-" + stamp + "-" + rand;
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data,
    });
    if (payment.purchaseId) {
      await this.purchases.activate(payment.purchaseId);
    }
    // Digital-product orders (books, bundles, subscriptions) grant access here.
    if (payment.orderId) {
      await this.orders.fulfill(payment.orderId);
    }
    // Physical-book orders: mark the hard copy order as paid/processing so the
    // fulfilment team can ship it. Idempotent.
    if (payment.hardCopyOrderId) {
      await this.prisma.hardCopyOrder.update({
        where: { id: payment.hardCopyOrderId },
        data: { status: HardCopyOrderStatus.PROCESSING },
      });
    }
    await this.notifications.create(payment.userId, {
      type: "PAYMENT_CONFIRMED",
      title: "Payment confirmed",
      body: `Your payment of ${payment.currency} ${payment.amount} was received.`,
      email: true,
    });
    // Post-purchase GHL sync for nurture automations (fire-and-forget).
    try {
      const buyer = await this.prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, name: true, phone: true },
      });
      if (buyer) {
        this.ghl.onPurchase({
          email: buyer.email,
          name: buyer.name,
          phone: buyer.phone,
          amount: payment.amount,
          currency: payment.currency,
        });
      }
    } catch {
      // never block payment confirmation on marketing sync
    }
    // Sales attribution + referral commission (fire-and-forget).
    try {
      await this.attribution.recordSale({
        paymentId: payment.id,
        buyerUserId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        tenantId: payment.tenantId,
        orderId: payment.orderId,
      });
    } catch {
      // attribution must never block payment confirmation
    }
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

  // ---- Manual offline bank transfer ----------------------------------------

  // Bank account details shown on the manual transfer screen. Configurable via
  // env so the account can change without a code deploy.
  bankDetails() {
    return {
      bankName: process.env.BANK_NAME || "UBL (United Bank Limited)",
      accountTitle: process.env.BANK_ACCOUNT_TITLE || "TALIB E QURAN",
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || "0350288676115",
      iban: process.env.BANK_IBAN || "PK20UNIL0109000288676115",
      instructions:
        process.env.BANK_INSTRUCTIONS ||
        "Transfer the exact amount to the account above, then upload your receipt and enter the transaction id. Your access is activated once we verify the payment (usually within a few hours).",
    };
  }

  // A buyer reports that they paid by offline bank transfer. We attach their
  // proof to the (still PENDING) payment and alert admins to verify it.
  async submitBankTransfer(
    userId: string,
    paymentId: string,
    dto: {
      proofKey?: string;
      senderName?: string;
      senderRef?: string;
      note?: string;
    },
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.userId !== userId)
      throw new ForbiddenException("This payment belongs to someone else");
    if (payment.status === PaymentStatus.PAID)
      throw new BadRequestException("This payment is already confirmed");
    if (!dto.proofKey && !dto.senderRef)
      throw new BadRequestException(
        "Please upload a receipt or enter the transaction id",
      );

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        gateway: "bank_transfer",
        proofKey: dto.proofKey || null,
        senderName: dto.senderName || null,
        senderRef: dto.senderRef || null,
        manualNote: dto.note || null,
      },
    });

    // Notify every admin that a transfer is awaiting verification.
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notifications.create(admin.id, {
        type: "BANK_TRANSFER_REVIEW",
        title: "Bank transfer to verify",
        body:
          (payment.user?.name || "A buyer") +
          " submitted a bank transfer of " +
          payment.currency +
          " " +
          payment.amount +
          ". Review and confirm it in payments.",
        email: true,
      });
    }

    return { ok: true, status: "PENDING_REVIEW", payment: updated };
  }

  // Admin confirms a verified bank transfer; reuses markPaid so the order is
  // fulfilled and the buyer notified exactly like an online payment.
  async verifyManual(paymentId: string, reference?: string) {
    return this.markPaid(paymentId, reference || "BANK-" + Date.now());
  }

  // Admin rejects a bank transfer that could not be verified.
  async rejectManual(paymentId: string, reason?: string) {
    const payment = await this.markFailed(paymentId, reason);
    await this.notifications.create(payment.userId, {
      type: "BANK_TRANSFER_REJECTED",
      title: "Bank transfer not verified",
      body:
        reason ||
        "We could not verify your bank transfer. Please check the details and try again, or contact support.",
      email: true,
    });
    return payment;
  }

  listForUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        purchase: { include: { package: true } },
        order: {
          include: { book: true, bundle: true, plan: true, course: true },
        },
        hardCopy: { include: { book: true } },
      },
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

  // Paginated / searchable / sortable list for the admin payments table.
  async listAllPaged(opts: {
    q?: string;
    status?: string;
    gateway?: string;
    kind?: string;
    channel?: string; // "online" (gateway) | "bank" (manual bank transfer)
    page?: string | number;
    pageSize?: string | number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<any>> {
    // Manual / non-gateway payment methods (reviewed by hand, not via a PSP).
    const MANUAL_GATEWAYS = ["bank_transfer", "manual", "cash"];
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.gateway) where.gateway = opts.gateway;
    if (opts.kind) where.kind = opts.kind;
    if (opts.channel === "online") where.gateway = { notIn: MANUAL_GATEWAYS };
    if (opts.channel === "bank") where.gateway = "bank_transfer";
    const term = (opts.q || "").trim();
    if (term) {
      where.OR = [
        { invoiceNo: { contains: term, mode: "insensitive" } },
        { senderName: { contains: term, mode: "insensitive" } },
        { senderRef: { contains: term, mode: "insensitive" } },
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
      ];
    }

    const orderBy = buildOrderBy(
      opts.sort,
      opts.order,
      { amount: "amount", status: "status", createdAt: "createdAt" },
      { createdAt: "desc" },
    );
    const { page, pageSize, skip, take } = parsePagination(
      opts.page,
      opts.pageSize,
    );

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          purchase: { include: { package: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }
}
