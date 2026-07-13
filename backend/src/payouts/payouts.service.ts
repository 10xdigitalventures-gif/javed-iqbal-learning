import { Injectable, Logger } from "@nestjs/common";
import { PayoutStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Records one earnings row per completed sale and powers the per-consultant
// revenue breakdown (Phase 5). A sale's gross is split into the platform fee
// (tenant.platformFeePercent, default/min 15%) and the owner's net payout.
// The "owner" is the tenant / main consultant — never a separately assigned
// user (per the locked spec).
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private prisma: PrismaService) {}

  // Resolve the tenant's commission %. Falls back to the platform minimum.
  private async feePercentForTenant(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { platformFeePercent: true },
    });
    const pct = tenant?.platformFeePercent;
    if (typeof pct !== "number" || pct < 0) return 15;
    return pct;
  }

  // The tenant's main consultant/owner user (for reporting). Optional.
  private async ownerUserForTenant(tenantId: string): Promise<string | null> {
    const consultant = await this.prisma.user.findFirst({
      where: { tenantId, role: "CONSULTANT" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return consultant?.id ?? null;
  }

  // Record a payout for a completed sale. Fire-and-forget safe: never throws
  // into the caller's fulfillment path.
  async recordSale(input: {
    tenantId?: string | null;
    ownerUserId?: string | null;
    paymentId?: string | null;
    orderId?: string | null;
    purchaseId?: string | null;
    productKind: string;
    productId?: string | null;
    productName?: string | null;
    grossAmount: number;
    currency?: string | null;
  }) {
    try {
      if (!input.tenantId) return null;
      if (!input.grossAmount || input.grossAmount <= 0) return null;

      // Idempotency: skip if we already recorded this exact source transaction.
      if (input.paymentId || input.orderId || input.purchaseId) {
        const existing = await this.prisma.payout.findFirst({
          where: {
            OR: [
              input.paymentId ? { paymentId: input.paymentId } : undefined,
              input.orderId ? { orderId: input.orderId } : undefined,
              input.purchaseId ? { purchaseId: input.purchaseId } : undefined,
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });
        if (existing) return existing;
      }

      const feePercent = await this.feePercentForTenant(input.tenantId);
      const gross = Math.round(input.grossAmount * 100) / 100;
      const platformFee = Math.round(gross * feePercent) / 100;
      const netAmount = Math.round((gross - platformFee) * 100) / 100;
      const ownerUserId =
        input.ownerUserId ?? (await this.ownerUserForTenant(input.tenantId));

      return await this.prisma.payout.create({
        data: {
          tenantId: input.tenantId,
          ownerUserId,
          paymentId: input.paymentId ?? null,
          orderId: input.orderId ?? null,
          purchaseId: input.purchaseId ?? null,
          productKind: input.productKind,
          productId: input.productId ?? null,
          productName: input.productName ?? null,
          grossAmount: gross,
          feePercent,
          platformFee,
          netAmount,
          currency: input.currency || "PKR",
          status: PayoutStatus.PENDING,
        },
      });
    } catch (err) {
      this.logger.warn(
        `recordSale failed (non-fatal): ${(err as Error).message}`,
      );
      return null;
    }
  }

  // Admin: raw payout rows (optionally filtered by tenant / status).
  list(opts: { tenantId?: string; status?: PayoutStatus } = {}) {
    return this.prisma.payout.findMany({
      where: {
        ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  // Admin (Phase 5): per-consultant/tenant revenue breakdown — who sold what
  // and how the money splits.
  async summaryByTenant() {
    const grouped = await this.prisma.payout.groupBy({
      by: ["tenantId"],
      _sum: { grossAmount: true, platformFee: true, netAmount: true },
      _count: { _all: true },
    });
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true, brandName: true, platformFeePercent: true },
    });
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return grouped
      .map((g) => {
        const t = byId.get(g.tenantId);
        return {
          tenantId: g.tenantId,
          name: t?.brandName || t?.name || g.tenantId,
          feePercent: t?.platformFeePercent ?? 15,
          sales: g._count._all,
          gross: g._sum.grossAmount ?? 0,
          platformFee: g._sum.platformFee ?? 0,
          net: g._sum.netAmount ?? 0,
        };
      })
      .sort((a, b) => b.gross - a.gross);
  }

  // Tenant-scoped summary for the dedicated admin panel (their own earnings).
  async tenantSummary(tenantId: string) {
    const agg = await this.prisma.payout.aggregate({
      where: { tenantId },
      _sum: { grossAmount: true, platformFee: true, netAmount: true },
      _count: { _all: true },
    });
    const recent = await this.prisma.payout.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      tenantId,
      sales: agg._count._all,
      gross: agg._sum.grossAmount ?? 0,
      platformFee: agg._sum.platformFee ?? 0,
      net: agg._sum.netAmount ?? 0,
      recent,
    };
  }
}
