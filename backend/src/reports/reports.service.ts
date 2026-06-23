import { Injectable } from "@nestjs/common";
import { MeetingStatus, PaymentStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Admin overview: platform-wide KPIs.
  async adminOverview() {
    const [
      clients,
      consultants,
      activePurchases,
      meetings,
      messages,
      communities,
      paidAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.CLIENT } }),
      this.prisma.user.count({ where: { role: Role.CONSULTANT } }),
      this.prisma.purchase.count({ where: { status: "ACTIVE" } }),
      this.prisma.meeting.count(),
      this.prisma.message.count(),
      this.prisma.community.count({ where: { isActive: true } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.PAID },
      }),
    ]);
    return {
      clients,
      consultants,
      activePurchases,
      meetings,
      messages,
      communities,
      revenue: paidAgg._sum.amount || 0,
    };
  }

  // Per-consultant utilization: clients + remaining allowances + sessions.
  async consultantStats(consultantId: string) {
    const [assignedClients, upcoming, purchases, messages] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { consultantId },
        select: { clientId: true },
        distinct: ["clientId"],
      }),
      this.prisma.meeting.count({
        where: {
          consultantId,
          status: MeetingStatus.APPROVED,
          scheduledAt: { gte: new Date() },
        },
      }),
      this.prisma.purchase.findMany({
        where: { consultantId, status: "ACTIVE" },
        include: { package: true, client: { select: { id: true, name: true } } },
      }),
      this.prisma.message.count({ where: { senderId: consultantId } }),
    ]);
    return {
      clientCount: assignedClients.length,
      upcomingMeetings: upcoming,
      messagesSent: messages,
      activePackages: purchases.map((p) => ({
        client: p.client,
        package: p.package?.name,
        text: this.remaining(p.textLimit, p.textUsed),
        audio: this.remaining(p.audioLimit, p.audioUsed),
        video: this.remaining(p.videoLimit, p.videoUsed),
        sessions: this.remaining(p.sessionLimit, p.sessionsUsed),
      })),
    };
  }

  // Per-client utilization: what they have left across active packages.
  async clientStats(clientId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { clientId, status: "ACTIVE" },
      include: {
        package: true,
        consultant: { select: { id: true, name: true } },
      },
    });
    return {
      activePackages: purchases.map((p) => ({
        consultant: p.consultant,
        package: p.package?.name,
        expiresAt: p.expiresAt,
        text: this.remaining(p.textLimit, p.textUsed),
        audio: this.remaining(p.audioLimit, p.audioUsed),
        video: this.remaining(p.videoLimit, p.videoUsed),
        sessions: this.remaining(p.sessionLimit, p.sessionsUsed),
      })),
    };
  }

  private remaining(limit: number | null, used: number) {
    if (limit === null || limit === undefined)
      return { limit: null, used, remaining: null, unlimited: true };
    return { limit, used, remaining: Math.max(0, limit - used), unlimited: false };
  }

  // Admin audit export: activity log as CSV text (for compliance / review).
  async auditCsv(limit = 5000): Promise<string> {
    const logs = await this.prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 20000),
      include: { user: { select: { email: true } } },
    });
    const header = ["createdAt", "userEmail", "action", "ip", "meta"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = logs.map((l) =>
      [
        l.createdAt.toISOString(),
        l.user?.email ?? "",
        l.action,
        l.ip ?? "",
        l.meta ?? "",
      ]
        .map(escape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }
}
