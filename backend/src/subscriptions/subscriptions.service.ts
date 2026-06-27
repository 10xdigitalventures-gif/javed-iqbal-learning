import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SubscriptionInterval, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto";
import {
  SUPPORTED_CURRENCIES,
  convert,
  exchangeRates,
  isSupportedCurrency,
  quote,
} from "../common/currency";

const DAY_MS = 24 * 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Subscription plans (admin-configurable) + a user's subscription state.
// Granting an actual subscription on payment lives in OrdersService.fulfill.
@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private notifications: NotificationsService,
  ) {}

  // Sensible default duration per interval when admin leaves durationDays blank.
  private defaultDuration(
    interval: SubscriptionInterval,
    explicit?: number,
  ): number | null {
    if (explicit != null) return explicit;
    switch (interval) {
      case SubscriptionInterval.MONTHLY:
        return 30;
      case SubscriptionInterval.SIX_MONTHS:
        return 182;
      case SubscriptionInterval.YEARLY:
        return 365;
      case SubscriptionInterval.LIFETIME:
        return null;
      default:
        return null;
    }
  }

  // Attach a display-currency price to a plan without changing what is charged.
  private decoratePlan(plan: any, currency?: string) {
    return {
      ...plan,
      display: quote(plan.price, plan.currency, currency),
    };
  }

  async listActivePlans(currency?: string) {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
    return plans.map((p) => this.decoratePlan(p, currency));
  }

  listAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: "asc" },
    });
  }

  // Supported display currencies + the active conversion rates.
  currencies() {
    return {
      base: "PKR",
      currencies: SUPPORTED_CURRENCIES,
      rates: exchangeRates(),
    };
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        interval: dto.interval,
        durationDays: this.defaultDuration(dto.interval, dto.durationDays),
        price: dto.price ?? 0,
        currency: dto.currency ?? "PKR",
        isActive: dto.isActive ?? true,
        features: dto.features ? JSON.stringify(dto.features) : null,
      },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException("Plan not found");
    const interval = dto.interval ?? plan.interval;
    const durationDays =
      dto.durationDays !== undefined || dto.interval !== undefined
        ? this.defaultDuration(interval, dto.durationDays ?? undefined)
        : plan.durationDays;
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        interval,
        durationDays,
        price: dto.price ?? undefined,
        currency: dto.currency ?? undefined,
        isActive: dto.isActive ?? undefined,
        features: dto.features ? JSON.stringify(dto.features) : undefined,
      },
    });
  }

  async deletePlan(id: string) {
    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  // The effective end of access: the later of expiry and any dunning grace date.
  private effectiveEnd(sub: {
    expiresAt: Date | null;
    graceUntil: Date | null;
  }): number | null {
    if (!sub.expiresAt) return null; // lifetime
    const exp = sub.expiresAt.getTime();
    const grace = sub.graceUntil ? sub.graceUntil.getTime() : exp;
    return Math.max(exp, grace);
  }

  // The user's current (most recent active, still-within-access) subscription.
  async mySubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    if (!sub) return { active: false, subscription: null };
    const end = this.effectiveEnd(sub);
    const expired = end != null && end < Date.now();
    if (expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      return { active: false, subscription: null };
    }
    const inGrace =
      !!sub.expiresAt && sub.expiresAt.getTime() < Date.now() && !expired;
    return { active: true, inGrace, subscription: sub };
  }

  myHistory(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
  }

  async cancel(userId: string, id: string) {
    await this.prisma.subscription.updateMany({
      where: { id, userId },
      data: { status: SubscriptionStatus.CANCELLED, autoRenew: false },
    });
    return { ok: true };
  }

  // ---- Proration ----
  // Quote the cost of switching to another plan now, crediting unused time on
  // the current plan. All base amounts are in the TARGET plan's currency;
  // `display` mirrors them in the buyer's chosen currency.
  async quoteChange(userId: string, targetPlanId: string, currency?: string) {
    const target = await this.prisma.subscriptionPlan.findUnique({
      where: { id: targetPlanId },
    });
    if (!target || !target.isActive)
      throw new NotFoundException("Plan not available");

    const current = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });

    let creditDays = 0;
    let creditRaw = 0; // in current plan currency
    if (
      current &&
      current.plan &&
      current.plan.durationDays &&
      current.plan.durationDays > 0 &&
      current.expiresAt
    ) {
      const remainingMs = current.expiresAt.getTime() - Date.now();
      creditDays = Math.max(0, Math.floor(remainingMs / DAY_MS));
      const fraction = Math.min(1, creditDays / current.plan.durationDays);
      creditRaw = current.plan.price * fraction;
    }

    // Convert any credit into the target plan's currency, then cap at price.
    const creditInTarget = current?.plan
      ? convert(creditRaw, current.plan.currency, target.currency)
      : 0;
    const appliedCredit = Math.min(Math.round(creditInTarget), target.price);
    const amountDue = Math.max(0, target.price - appliedCredit);
    const isSamePlan = !!current && current.planId === target.id;

    return {
      currentPlan: current?.plan
        ? {
            id: current.plan.id,
            name: current.plan.name,
            price: current.plan.price,
            currency: current.plan.currency,
            interval: current.plan.interval,
            expiresAt: current.expiresAt,
          }
        : null,
      targetPlan: {
        id: target.id,
        name: target.name,
        price: target.price,
        currency: target.currency,
        interval: target.interval,
        durationDays: target.durationDays,
      },
      isSamePlan,
      creditDays,
      credit: appliedCredit,
      targetPrice: target.price,
      amountDue,
      currency: target.currency,
      display: {
        targetPrice: quote(target.price, target.currency, currency),
        credit: quote(appliedCredit, target.currency, currency),
        amountDue: quote(amountDue, target.currency, currency),
      },
    };
  }

  // Begin a plan change: creates a (possibly prorated) subscription order to pay.
  async changePlan(userId: string, targetPlanId: string, currency?: string) {
    const q = await this.quoteChange(userId, targetPlanId, currency);
    const created = await this.orders.createSubscriptionOrder(
      userId,
      targetPlanId,
      { amount: q.amountDue },
    );
    return { ...created, quote: q };
  }

  // Begin a manual renewal of the active subscription.
  async renewNow(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    if (!sub || !sub.plan)
      throw new BadRequestException("No active subscription to renew");
    if (sub.plan.durationDays == null)
      throw new BadRequestException("Lifetime plans do not need renewal");
    const created = await this.orders.createSubscriptionOrder(
      userId,
      sub.plan.id,
    );
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { pendingOrderId: created.order.id },
    });
    return created;
  }

  // ---- Dunning / retry ----
  // Walk auto-renewing subscriptions: send renewal reminders as expiry nears,
  // keep access during a grace window while payment is retried, and expire the
  // subscription once the grace window passes or attempts are exhausted.
  // Designed to be invoked on a schedule (e.g. a daily cron hitting the admin
  // endpoint) since there is no stored card to auto-charge.
  async processDunning() {
    const reminderDays = envInt("SUB_RENEW_REMINDER_DAYS", 3);
    const graceDays = envInt("SUB_GRACE_DAYS", 7);
    const maxAttempts = envInt("SUB_MAX_RENEW_ATTEMPTS", 4);
    const now = Date.now();

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        expiresAt: { not: null },
      },
      include: { plan: true },
    });

    let reminded = 0;
    let expired = 0;
    let renewalOrdersCreated = 0;

    for (const sub of subs) {
      if (!sub.expiresAt || !sub.plan || sub.plan.durationDays == null)
        continue;
      const exp = sub.expiresAt.getTime();
      const reminderStart = exp - reminderDays * DAY_MS;
      const graceEnd = sub.graceUntil
        ? sub.graceUntil.getTime()
        : exp + graceDays * DAY_MS;

      // Not yet inside the reminder window.
      if (now < reminderStart) continue;

      // Grace window passed or attempts exhausted → expire (only after expiry).
      if (now > exp && (now > graceEnd || sub.renewAttempts >= maxAttempts)) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.EXPIRED,
            autoRenew: false,
          },
        });
        await this.notifications.create(sub.userId, {
          type: "subscription_expired",
          title: "Subscription expired",
          body:
            "Your " +
            sub.plan.name +
            " subscription has expired. Renew anytime to restore access.",
          email: true,
        });
        expired++;
        continue;
      }

      // Throttle: at most one reminder per day.
      const lastRem = sub.lastReminderAt ? sub.lastReminderAt.getTime() : 0;
      if (now - lastRem < DAY_MS) continue;

      // Ensure there is an open renewal order to pay.
      let pendingOrderId = sub.pendingOrderId;
      let needNew = true;
      if (pendingOrderId) {
        const ord = await this.prisma.order.findUnique({
          where: { id: pendingOrderId },
        });
        if (ord && ord.status !== "FAILED") needNew = false;
      }
      if (needNew) {
        const created = await this.orders.createSubscriptionOrder(
          sub.userId,
          sub.planId,
        );
        pendingOrderId = created.order.id;
        renewalOrdersCreated++;
      }

      const attemptNo = sub.renewAttempts + 1;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          renewAttempts: { increment: 1 },
          lastReminderAt: new Date(now),
          graceUntil: new Date(graceEnd),
          pendingOrderId,
        },
      });
      await this.notifications.create(sub.userId, {
        type: "subscription_renewal",
        title: "Renew your subscription",
        body:
          "Your " +
          sub.plan.name +
          " plan is due for renewal. Complete payment to keep your access (reminder " +
          attemptNo +
          " of " +
          maxAttempts +
          ").",
        email: true,
      });
      reminded++;
    }

    return { reminded, expired, renewalOrdersCreated };
  }
}
