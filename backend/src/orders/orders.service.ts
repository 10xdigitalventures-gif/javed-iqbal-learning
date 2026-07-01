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
import { Paginated, parsePagination, buildOrderBy } from "../common/list-query";
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
      let bundleOffer = null;
      if (dto.offerId) {
        bundleOffer = await this.prisma.bundleOffer.findFirst({
          where: { id: dto.offerId, bundleId: bundle.id, isActive: true },
        });
      }
      amount = bundleOffer ? bundleOffer.price : bundle.price;
      currency = bundleOffer ? bundleOffer.currency : bundle.currency;
      itemName = bundleOffer ? bundleOffer.name : bundle.title;
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
    } else if (dto.kind === LearningProductKind.COURSE) {
      if (!dto.courseId) throw new BadRequestException("courseId is required");
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || !course.isPublished)
        throw new NotFoundException("Course not available");
      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      if (existing)
        throw new BadRequestException(
          "You are already enrolled in this course",
        );
      amount = course.price;
      currency = course.currency;
      itemName = course.title;
      data.courseId = course.id;
    } else if (dto.kind === LearningProductKind.COMMUNITY) {
      if (!dto.communityId)
        throw new BadRequestException("communityId is required");
      const community = await this.prisma.community.findUnique({
        where: { id: dto.communityId },
      });
      if (!community || !community.isActive)
        throw new NotFoundException("Community not available");
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId,
          },
        },
      });
      if (member)
        throw new BadRequestException(
          "You are already a member of this community",
        );
      let commOffer = null;
      if (dto.offerId) {
        commOffer = await this.prisma.communityOffer.findFirst({
          where: { id: dto.offerId, communityId: community.id, isActive: true },
        });
      }
      if (commOffer) {
        amount = commOffer.price;
        currency = commOffer.currency;
        itemName = commOffer.name;
      } else {
        if (!community.isPaid)
          throw new BadRequestException("This community is free to join");
        amount = community.price;
        currency = community.currency;
        itemName = community.name;
      }
      data.communityId = community.id;
    } else {
      throw new BadRequestException("Unsupported order kind");
    }

    // ---- Global coupon (optional) ----
    let discount = 0;
    let couponCode: string | null = null;
    if (dto.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: dto.couponCode.trim().toUpperCase() },
      });
      const now = Date.now();
      const usable =
        coupon &&
        coupon.isActive &&
        (!coupon.expiresAt || new Date(coupon.expiresAt).getTime() >= now) &&
        (coupon.maxRedemptions == null ||
          coupon.timesRedeemed < coupon.maxRedemptions);
      if (!usable) throw new BadRequestException("Invalid or expired coupon");
      discount =
        coupon.discountType === "FIXED"
          ? Math.min(coupon.amount, amount)
          : Math.round(((amount * coupon.amount) / 100) * 100) / 100;
      discount = Math.max(0, Math.min(discount, amount));
      amount = Math.max(0, Math.round((amount - discount) * 100) / 100);
      couponCode = coupon.code;
      await this.prisma.coupon.update({
        where: { id: coupon.id },
        data: { timesRedeemed: { increment: 1 } },
      });
    }

    const order = await this.prisma.order.create({
      data: {
        ...data,
        amount,
        currency,
        discount,
        couponCode,
        offerId: dto.offerId ?? null,
      },
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

  // Create a subscription order with an explicit amount (used for prorated plan
  // changes and renewals). Always charged in the plan's own currency.
  async createSubscriptionOrder(
    userId: string,
    planId: string,
    opts?: { amount?: number },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.isActive)
      throw new NotFoundException("Plan not available");
    const amount =
      opts?.amount != null ? Math.max(0, Math.round(opts.amount)) : plan.price;
    const currency = plan.currency;
    const order = await this.prisma.order.create({
      data: {
        userId,
        kind: LearningProductKind.SUBSCRIPTION,
        status: OrderStatus.PENDING,
        planId: plan.id,
        amount,
        currency,
      },
    });
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        orderId: order.id,
        amount,
        currency,
        gateway: this.defaultGateway(),
        kind: PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        invoiceNo: this.invoiceNo(),
      },
    });
    return { order, payment, itemName: plan.name };
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
    } else if (order.kind === LearningProductKind.COURSE && order.courseId) {
      // Compute the access window from the course default duration (if any).
      const courseRow = await this.prisma.course.findUnique({
        where: { id: order.courseId },
        select: { accessDurationDays: true },
      });
      const days = courseRow?.accessDurationDays ?? null;
      const accessUntil =
        days && days > 0
          ? new Date(Date.now() + days * 24 * 3600 * 1000)
          : null;
      await this.prisma.enrollment.upsert({
        where: {
          userId_courseId: { userId: order.userId, courseId: order.courseId },
        },
        create: {
          userId: order.userId,
          courseId: order.courseId,
          accessUntil,
          revokedAt: null,
        },
        // Renewal/re-purchase resets the window and clears any revoke.
        update: { accessUntil, revokedAt: null },
      });
    } else if (
      order.kind === LearningProductKind.COMMUNITY &&
      order.communityId
    ) {
      await this.prisma.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: order.communityId,
            userId: order.userId,
          },
        },
        create: { communityId: order.communityId, userId: order.userId },
        update: {},
      });
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
    const now = Date.now();
    const durationMs = plan.durationDays
      ? plan.durationDays * 24 * 60 * 60 * 1000
      : null;

    // Most recent active subscription for this user, if any.
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      orderBy: { startedAt: "desc" },
    });

    // Renewal of the SAME plan: extend from the later of now / current expiry
    // and clear any dunning state.
    if (existing && existing.planId === planId && durationMs != null) {
      const base =
        existing.expiresAt && existing.expiresAt.getTime() > now
          ? existing.expiresAt.getTime()
          : now;
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          expiresAt: new Date(base + durationMs),
          autoRenew: true,
          renewAttempts: 0,
          lastReminderAt: null,
          graceUntil: null,
          pendingOrderId: null,
        },
      });
      return;
    }

    // Switching to a different plan: supersede the old subscription.
    if (existing && existing.planId !== planId) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: { status: SubscriptionStatus.CANCELLED, autoRenew: false },
      });
    }

    const expiresAt = durationMs != null ? new Date(now + durationMs) : null;
    await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: durationMs != null,
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

  // Paginated / searchable / sortable list for the admin orders table.
  async listAllPaged(opts: {
    q?: string;
    status?: string;
    kind?: string;
    page?: string | number;
    pageSize?: string | number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<any>> {
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.kind) where.kind = opts.kind;
    const term = (opts.q || "").trim();
    if (term) {
      where.OR = [
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
        { book: { title: { contains: term, mode: "insensitive" } } },
        { bundle: { title: { contains: term, mode: "insensitive" } } },
        { plan: { name: { contains: term, mode: "insensitive" } } },
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
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          book: { select: { id: true, title: true } },
          bundle: { select: { id: true, title: true } },
          plan: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { rows, total, page, pageSize };
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
