import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EntitlementSource,
  LearningProductKind,
  OrderStatus,
  PaymentKind,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto";

// Commerce for digital products (books, bundles, subscription plans). Creates a
// PENDING Order + PENDING Payment; the payment webhook later calls fulfill(),
// which is the single place that grants access. Mirrors PurchasesService so the
// two commerce flows stay consistent.
@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    let amount = 0;
    let currency = "PKR";
    let itemName = "Order";
    const data: any = { userId, kind: dto.kind, status: OrderStatus.PENDING };

    if (dto.kind === LearningProductKind.BOOK) {
      if (!dto.bookId) throw new BadRequestException("bookId is required");
      const book = await this.prisma.book.findUnique({
        where: { id: dto.bookId },
      });
      if (!book || !book.isPublished)
        throw new NotFoundException("Book not available");
      const owned = await this.prisma.entitlement.findUnique({
        where: { userId_bookId: { userId, bookId: book.id } },
      });
      if (owned?.isActive)
        throw new BadRequestException("You already own this book");
      amount = book.price;
      currency = book.currency;
      itemName = book.title;
      data.bookId = book.id;
    } else if (dto.kind === LearningProductKind.BUNDLE) {
      if (!dto.bundleId) throw new BadRequestException("bundleId is required");
      const bundle = await this.prisma.bundle.findUnique({
        where: { id: dto.bundleId },
      });
      if (!bundle || !bundle.isPublished)
        throw new NotFoundException("Bundle not available");
      amount = bundle.price;
      currency = bundle.currency;
      itemName = bundle.title;
      data.bundleId = bundle.id;
    } else if (dto.kind === LearningProductKind.SUBSCRIPTION) {
      if (!dto.planId) throw new BadRequestException("planId is required");
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan || !plan.isActive)
        throw new NotFoundException("Plan not available");
      amount = plan.price;
      currency = plan.currency;
      itemName = plan.name;
      data.planId = plan.id;
    } else {
      throw new BadRequestException("Unsupported order kind");
    }

    const order = await this.prisma.order.create({
      data: { ...data, amount, currency },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        orderId: order.id,
        amount,
        currency,
        gateway: this.defaultGateway(),
        kind:
          dto.kind === LearningProductKind.SUBSCRIPTION
            ? PaymentKind.SUBSCRIPTION
            : PaymentKind.ONE_TIME,
        status: PaymentStatus.PENDING,
        invoiceNo: this.invoiceNo(),
      },
    });

    return { order, payment, itemName };
  }

  // Grant access for a paid order. Idempotent — safe to call from a webhook that
  // may be delivered more than once.
  async fulfill(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === OrderStatus.PAID) return order;

    if (order.kind === LearningProductKind.BOOK && order.bookId) {
      await this.grantBook(
        order.userId,
        order.bookId,
        EntitlementSource.PURCHASE,
      );
    } else if (order.kind === LearningProductKind.BUNDLE && order.bundleId) {
      const items = await this.prisma.bundleItem.findMany({
        where: { bundleId: order.bundleId },
      });
      for (const item of items) {
        await this.grantBook(
          order.userId,
          item.bookId,
          EntitlementSource.BUNDLE,
        );
      }
    } else if (
      order.kind === LearningProductKind.SUBSCRIPTION &&
      order.planId
    ) {
      await this.grantSubscription(order.userId, order.planId);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });
  }

  // One-time book ownership = lifetime entitlement (expiresAt stays null).
  private grantBook(userId: string, bookId: string, source: EntitlementSource) {
    return this.prisma.entitlement.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { isActive: true, source, expiresAt: null },
      create: { userId, bookId, source },
    });
  }

  private async grantSubscription(userId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) return;
    const expiresAt = plan.durationDays
      ? new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)
      : null; // null = lifetime
    await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: plan.durationDays != null,
        expiresAt,
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { book: true, bundle: true, plan: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
  }

  listAll() {
    return this.prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true } },
        bundle: { select: { id: true, title: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { book: true, bundle: true, plan: true, payments: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private invoiceNo() {
    return "ORD-" + Date.now().toString(36).toUpperCase();
  }

  private defaultGateway() {
    const first = (process.env.PAYMENT_PROVIDERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || "mock";
  }
}
