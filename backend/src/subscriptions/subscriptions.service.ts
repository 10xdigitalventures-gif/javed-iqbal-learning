import { Injectable, NotFoundException } from "@nestjs/common";
import { SubscriptionInterval, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto";

// Subscription plans (admin-configurable) + a user's subscription state.
// Granting an actual subscription on payment lives in OrdersService.fulfill.
@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

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

  listActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
  }

  listAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: "asc" },
    });
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

  // The user's current (most recent active, non-expired) subscription.
  async mySubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    if (!sub) return { active: false, subscription: null };
    const expired = !!sub.expiresAt && sub.expiresAt.getTime() < Date.now();
    if (expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      return { active: false, subscription: null };
    }
    return { active: true, subscription: sub };
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
}
