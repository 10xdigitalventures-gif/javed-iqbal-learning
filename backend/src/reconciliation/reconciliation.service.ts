import { BadRequestException, Injectable } from "@nestjs/common";
import { CommissionStatus, PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Revenue reconciliation (Phase 2 growth engine).
//
// Two revenue engines feed the business: in-app payments ("App") and the GHL
// marketing/sales funnel ("External", entered/imported manually since it lives
// outside this system). This service produces a per-month split report, a
// channel breakdown for App revenue (via sale attribution), commission
// liabilities, and a month-end close that snapshots + locks the numbers.
@Injectable()
export class ReconciliationService {
  constructor(private prisma: PrismaService) {}

  private currentPeriod(): string {
    const d = new Date();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return d.getUTCFullYear() + "-" + m;
  }

  private validPeriod(period?: string): string {
    const p = (period || "").trim() || this.currentPeriod();
    if (!/^\d{4}-\d{2}$/.test(p)) {
      throw new BadRequestException("period must be in YYYY-MM format");
    }
    return p;
  }

  private monthRange(period: string) {
    const parts = period.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { start, end };
  }

  // App revenue for the month + a channel split (DIRECT / REFERRAL / ASSISTED)
  // derived from sale attribution rows.
  private async appRevenue(period: string, tenantId?: string | null) {
    const { start, end } = this.monthRange(period);
    const where: Record<string, unknown> = {
      status: PaymentStatus.PAID,
      createdAt: { gte: start, lte: end },
    };
    if (tenantId) where.tenantId = tenantId;
    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where,
    });

    const attrWhere: Record<string, unknown> = {
      createdAt: { gte: start, lte: end },
    };
    if (tenantId) attrWhere.tenantId = tenantId;
    const grouped = await this.prisma.saleAttribution.groupBy({
      by: ["channel"],
      where: attrWhere,
      _count: { _all: true },
      _sum: { amount: true },
    });
    return {
      total: agg._sum.amount || 0,
      count: agg._count._all,
      byChannel: grouped.map((g) => ({
        channel: g.channel,
        count: g._count._all,
        amount: g._sum.amount || 0,
      })),
    };
  }

  private async externalRevenue(period: string, tenantId?: string | null) {
    const where: Record<string, unknown> = { period };
    if (tenantId) where.tenantId = tenantId;
    const [agg, entries] = await Promise.all([
      this.prisma.externalRevenue.aggregate({ _sum: { amount: true }, where }),
      this.prisma.externalRevenue.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { total: agg._sum.amount || 0, entries };
  }

  private async commissionTotal(period: string, tenantId?: string | null) {
    const { start, end } = this.monthRange(period);
    const where: Record<string, unknown> = {
      createdAt: { gte: start, lte: end },
      status: { not: CommissionStatus.VOID },
    };
    if (tenantId) where.tenantId = tenantId;
    const agg = await this.prisma.commission.aggregate({
      _sum: { amount: true },
      where,
    });
    return agg._sum.amount || 0;
  }

  // Full reconciliation view for a month: App vs External split, channel
  // breakdown, commission liability, and whether the month is already closed.
  async reconcile(period?: string, tenantId?: string | null) {
    const p = this.validPeriod(period);
    const [app, external, commission, closed] = await Promise.all([
      this.appRevenue(p, tenantId),
      this.externalRevenue(p, tenantId),
      this.commissionTotal(p, tenantId),
      this.prisma.monthlyClose.findFirst({
        where: tenantId ? { period: p, tenantId } : { period: p },
      }),
    ]);
    const totalRevenue = app.total + external.total;
    return {
      period: p,
      tenantId: tenantId ?? null,
      app,
      external,
      totalRevenue,
      commissionTotal: commission,
      netAfterCommission: totalRevenue - commission,
      appShare: totalRevenue ? app.total / totalRevenue : 0,
      externalShare: totalRevenue ? external.total / totalRevenue : 0,
      closed: closed ?? null,
    };
  }

  async addExternal(
    dto: {
      source?: string;
      period: string;
      amount: number;
      currency?: string;
      note?: string;
    },
    userId?: string,
  ) {
    const p = this.validPeriod(dto.period);
    return this.prisma.externalRevenue.create({
      data: {
        source: (dto.source || "GHL").trim(),
        period: p,
        amount: dto.amount,
        currency: dto.currency || "PKR",
        note: dto.note ?? null,
        createdBy: userId ?? null,
      },
    });
  }

  async listExternal(period?: string, tenantId?: string | null) {
    const where: Record<string, unknown> = {};
    if (period) where.period = this.validPeriod(period);
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.externalRevenue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async deleteExternal(id: string) {
    await this.prisma.externalRevenue.delete({ where: { id } });
    return { ok: true };
  }

  // Month-end close: snapshot the reconciled numbers and lock them in. Re-
  // running for the same period/tenant recomputes the snapshot.
  async close(period: string, tenantId?: string | null, userId?: string) {
    const r = await this.reconcile(period, tenantId);
    const data = {
      appRevenue: r.app.total,
      externalRevenue: r.external.total,
      totalRevenue: r.totalRevenue,
      commissionTotal: r.commissionTotal,
      currency: "PKR",
      breakdown: {
        byChannel: r.app.byChannel,
        externalEntries: r.external.entries.length,
      },
      closedBy: userId ?? null,
    };
    const existing = await this.prisma.monthlyClose.findFirst({
      where: tenantId ? { period: r.period, tenantId } : { period: r.period },
    });
    if (existing) {
      return this.prisma.monthlyClose.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.monthlyClose.create({
      data: Object.assign({}, data, {
        period: r.period,
        tenantId: tenantId ?? null,
      }),
    });
  }

  async listCloses(tenantId?: string | null) {
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.monthlyClose.findMany({
      where,
      orderBy: { period: "desc" },
      take: 60,
    });
  }

  private csvEscape(v: unknown) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async reconcileCsv(
    period?: string,
    tenantId?: string | null,
  ): Promise<string> {
    const r = await this.reconcile(period, tenantId);
    const esc = (arr: unknown[]) => arr.map((v) => this.csvEscape(v)).join(",");
    const lines: string[] = [];
    lines.push(esc(["metric", "value"]));
    lines.push(esc(["period", r.period]));
    lines.push(esc(["app_revenue", r.app.total]));
    lines.push(esc(["external_revenue", r.external.total]));
    lines.push(esc(["total_revenue", r.totalRevenue]));
    lines.push(esc(["commission_total", r.commissionTotal]));
    lines.push(esc(["net_after_commission", r.netAfterCommission]));
    lines.push("");
    lines.push(esc(["channel", "count", "amount"]));
    for (const c of r.app.byChannel) {
      lines.push(esc([c.channel, c.count, c.amount]));
    }
    return lines.join("\n");
  }
}
