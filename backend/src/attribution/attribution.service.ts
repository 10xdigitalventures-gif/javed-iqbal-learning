import { Injectable } from "@nestjs/common";
import { CommissionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GamificationService } from "../gamification/gamification.service";

// Sales attribution + referral commission engine (Phase 2 growth engine).
//
// Flow: a shareable referral code belongs to a user (affiliate/consultant).
// Links carry ?ref=CODE; the code is remembered on the buyer at signup and/or
// passed at checkout. When a payment is confirmed we record a SaleAttribution
// and, if a valid referral source exists, a PENDING Commission for the code
// owner. Everything here is best-effort and must never block a payment.
@Injectable()
export class AttributionService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  // Normalize a raw referral code: uppercase, keep [A-Z0-9_-], cap length.
  private normalize(code?: string | null): string {
    return (code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 40);
  }

  // Build a short code from a base string (usually the owner's name).
  private genCode(base: string): string {
    const root = this.normalize(base).slice(0, 10) || "REF";
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return root + "-" + rand;
  }

  // Return the caller's active shareable referral code, creating one on first
  // use. Retries a few times to dodge unique collisions, then hard-guarantees
  // uniqueness with a timestamp suffix.
  async getOrCreateMyCode(userId: string, tenantId?: string | null) {
    const existing = await this.prisma.referralCode.findFirst({
      where: { ownerUserId: userId, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    for (let i = 0; i < 5; i++) {
      const code = this.genCode(user?.name || "REF");
      const clash = await this.prisma.referralCode.findUnique({
        where: { code },
      });
      if (!clash) {
        return this.prisma.referralCode.create({
          data: { code, ownerUserId: userId, tenantId: tenantId ?? null },
        });
      }
    }
    const code =
      this.genCode(user?.name || "REF") +
      "-" +
      Date.now().toString(36).toUpperCase();
    return this.prisma.referralCode.create({
      data: { code, ownerUserId: userId, tenantId: tenantId ?? null },
    });
  }

  // Resolve an active referral code record from a raw string.
  async resolveCode(code?: string | null) {
    const c = this.normalize(code);
    if (!c) return null;
    return this.prisma.referralCode.findFirst({
      where: { code: c, active: true },
    });
  }

  // Public: count a click on a referral link (best-effort, no auth).
  async trackClick(code?: string | null) {
    const rc = await this.resolveCode(code);
    if (!rc) return { ok: false };
    await this.prisma.referralCode.update({
      where: { id: rc.id },
      data: { clicks: { increment: 1 } },
    });
    return { ok: true };
  }

  // Remember the referral code that brought a user in (called at signup).
  // Ignores unknown codes and self-referrals.
  async attachSignupReferral(userId: string, code?: string | null) {
    const rc = await this.resolveCode(code);
    if (!rc || rc.ownerUserId === userId) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { referredByCode: rc.code },
    });
  }

  // Core money hook, called after a payment is marked PAID. Idempotent per
  // payment. Records an attribution and, when a valid referral source is found,
  // a PENDING commission for the code owner.
  async recordSale(input: {
    paymentId: string;
    buyerUserId: string;
    amount: number;
    currency?: string | null;
    tenantId?: string | null;
    orderId?: string | null;
    code?: string | null;
    assistedById?: string | null;
    landingUrl?: string | null;
  }) {
    // Idempotency: one attribution row per payment.
    const seen = await this.prisma.saleAttribution.findUnique({
      where: { paymentId: input.paymentId },
    });
    if (seen) return seen;

    // Resolve the referral source: explicit code first, else the buyer's
    // remembered signup referral.
    let rc = await this.resolveCode(input.code);
    if (!rc) {
      const buyer = await this.prisma.user.findUnique({
        where: { id: input.buyerUserId },
        select: { referredByCode: true },
      });
      rc = await this.resolveCode(buyer?.referredByCode);
    }
    // A buyer can never earn commission on their own purchase.
    if (rc && rc.ownerUserId === input.buyerUserId) rc = null;

    const currency = input.currency || "PKR";
    const channel = rc
      ? "REFERRAL"
      : input.assistedById
        ? "ASSISTED"
        : "DIRECT";

    const attribution = await this.prisma.saleAttribution.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId ?? null,
        buyerUserId: input.buyerUserId,
        referralCodeId: rc?.id ?? null,
        referrerUserId: rc?.ownerUserId ?? null,
        assistedById: input.assistedById ?? null,
        channel,
        amount: input.amount,
        currency,
        landingUrl: input.landingUrl ?? null,
        tenantId: input.tenantId ?? null,
      },
    });

    // Commission only when there is a referrer to pay.
    if (rc) {
      const rate = rc.ratePercent ?? 0;
      const amount = Math.round(input.amount * rate) / 100;
      await this.prisma.commission.create({
        data: {
          attributionId: attribution.id,
          referralCodeId: rc.id,
          paymentId: input.paymentId,
          beneficiaryId: rc.ownerUserId,
          baseAmount: input.amount,
          ratePercent: rate,
          amount,
          currency,
          status: CommissionStatus.PENDING,
          tenantId: input.tenantId ?? null,
        },
      });

      // Referral reward points (idempotent per payment; best-effort).
      try {
        const already = await this.prisma.referralReward.findUnique({
          where: { paymentId: input.paymentId },
        });
        if (!already) {
          const referrerPoints = Number(
            process.env.REFERRAL_REWARD_POINTS || 100,
          );
          const referredPoints = Number(
            process.env.REFERRAL_WELCOME_POINTS || 50,
          );
          await this.prisma.referralReward.create({
            data: {
              paymentId: input.paymentId,
              referrerUserId: rc.ownerUserId,
              referredUserId: input.buyerUserId,
              referrerPoints,
              referredPoints,
              tenantId: input.tenantId ?? null,
            },
          });
          await this.gamification.awardBonusPoints(
            rc.ownerUserId,
            referrerPoints,
          );
          await this.gamification.awardBonusPoints(
            input.buyerUserId,
            referredPoints,
          );
        }
      } catch {
        // reward points must never block the sale
      }
    }
    return attribution;
  }

  // Sum commission amounts by status. VOID is excluded from the running total.
  private totals(rows: Array<{ amount: number; status: CommissionStatus }>) {
    const t = { pending: 0, approved: 0, paid: 0, void: 0, total: 0 };
    for (const r of rows) {
      if (r.status === CommissionStatus.PENDING) t.pending += r.amount;
      else if (r.status === CommissionStatus.APPROVED) t.approved += r.amount;
      else if (r.status === CommissionStatus.PAID) t.paid += r.amount;
      else if (r.status === CommissionStatus.VOID) t.void += r.amount;
      if (r.status !== CommissionStatus.VOID) t.total += r.amount;
    }
    return t;
  }

  // Affiliate/referrer view of their own codes + earnings.
  async myEarnings(userId: string) {
    const [commissions, codes, rewards] = await Promise.all([
      this.prisma.commission.findMany({
        where: { beneficiaryId: userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.referralCode.findMany({ where: { ownerUserId: userId } }),
      this.prisma.referralReward.findMany({
        where: { referrerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
    const rewardPoints = rewards.reduce((s, r) => s + r.referrerPoints, 0);
    return {
      totals: this.totals(commissions),
      rewardPoints,
      commissions,
      codes,
      rewards,
    };
  }

  // Admin: commission ledger with light filters.
  async listCommissions(
    opts: { status?: string; beneficiaryId?: string } = {},
  ) {
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.beneficiaryId) where.beneficiaryId = opts.beneficiaryId;
    const rows = await this.prisma.commission.findMany({
      where,
      include: {
        beneficiary: { select: { id: true, name: true, email: true } },
        referralCode: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { totals: this.totals(rows), commissions: rows };
  }

  async setCommissionStatus(id: string, status: CommissionStatus) {
    return this.prisma.commission.update({ where: { id }, data: { status } });
  }

  // Admin: attribution + commission summary for reporting.
  async summary(tenantId?: string | null) {
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    const [commissions, byChannel] = await Promise.all([
      this.prisma.commission.findMany({ where }),
      this.prisma.saleAttribution.groupBy({
        by: ["channel"],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    return {
      commissionTotals: this.totals(commissions),
      byChannel: byChannel.map((c) => ({
        channel: c.channel,
        count: c._count._all,
        amount: c._sum.amount || 0,
      })),
    };
  }
}
