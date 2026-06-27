import { Injectable } from "@nestjs/common";
import {
  MeetingStatus,
  OrderStatus,
  PaymentStatus,
  Role,
} from "@prisma/client";
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
        include: {
          package: true,
          client: { select: { id: true, name: true } },
        },
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
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      unlimited: false,
    };
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

  // ---- Time-series + funnel analytics (Phase 5) ----

  // Resolve an inclusive [start, end] window from optional YYYY-MM-DD strings.
  // Defaults to the last 30 days when no range is supplied. Guards against
  // inverted ranges and clamps the span to one year to keep buckets bounded.
  private parseRange(from?: string, to?: string) {
    const end = from || to ? this.atEndOfDay(to) : new Date();
    end.setHours(23, 59, 59, 999);
    let start: Date;
    if (from) {
      start = new Date(from);
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - 29);
    }
    start.setHours(0, 0, 0, 0);
    if (start > end) start = new Date(end.getTime() - 29 * 86400000);
    const maxSpan = 366 * 86400000;
    if (end.getTime() - start.getTime() > maxSpan) {
      start = new Date(end.getTime() - maxSpan);
    }
    return { start, end };
  }

  private atEndOfDay(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private dayKey(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  // A zero-filled map of every day in the range so charts have no gaps.
  private emptyDays(start: Date, end: Date): Record<string, number> {
    const out: Record<string, number> = {};
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      out[this.dayKey(cur)] = 0;
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  private toSeries(map: Record<string, number>) {
    return Object.keys(map)
      .sort()
      .map((date) => ({ date, value: Math.round(map[date] * 100) / 100 }));
  }

  private csvEscape(v: unknown) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  // Daily time-series for revenue, paid orders, signups, course enrollments
  // and lesson completions across the requested window.
  async timeseries(from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);
    const range = { gte: start, lte: end };
    const [orders, users, enrollments, completions] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: OrderStatus.PAID, createdAt: range },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: range },
        select: { createdAt: true },
      }),
      this.prisma.enrollment.findMany({
        where: { startedAt: range },
        select: { startedAt: true },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { completedAt: range },
        select: { completedAt: true },
      }),
    ]);

    const revenue = this.emptyDays(start, end);
    const orderCount = this.emptyDays(start, end);
    for (const o of orders) {
      const k = this.dayKey(o.createdAt);
      if (k in revenue) {
        revenue[k] += o.amount;
        orderCount[k] += 1;
      }
    }
    const signups = this.emptyDays(start, end);
    for (const u of users) {
      const k = this.dayKey(u.createdAt);
      if (k in signups) signups[k] += 1;
    }
    const enr = this.emptyDays(start, end);
    for (const e of enrollments) {
      const k = this.dayKey(e.startedAt);
      if (k in enr) enr[k] += 1;
    }
    const lessons = this.emptyDays(start, end);
    for (const c of completions) {
      if (!c.completedAt) continue;
      const k = this.dayKey(c.completedAt);
      if (k in lessons) lessons[k] += 1;
    }

    return {
      from: this.dayKey(start),
      to: this.dayKey(end),
      series: {
        revenue: this.toSeries(revenue),
        orders: this.toSeries(orderCount),
        signups: this.toSeries(signups),
        enrollments: this.toSeries(enr),
        lessonCompletions: this.toSeries(lessons),
      },
      totals: {
        revenue: orders.reduce((s, o) => s + o.amount, 0),
        orders: orders.length,
        signups: users.length,
        enrollments: enrollments.length,
        lessonCompletions: completions.length,
      },
    };
  }

  // Per-course completion / drop-off funnel for enrollments started in range.
  async courseFunnel(from?: string, to?: string) {
    const { start, end } = this.parseRange(from, to);
    const courses = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        _count: { select: { lessons: true } },
        enrollments: {
          where: { startedAt: { gte: start, lte: end } },
          select: {
            percentComplete: true,
            lessonsComplete: true,
            completedAt: true,
          },
        },
      },
    });

    const round1 = (n: number) => Math.round(n * 10) / 10;
    const rows = courses
      .map((c) => {
        const enrolled = c.enrollments.length;
        const started = c.enrollments.filter(
          (e) => e.lessonsComplete > 0 || e.percentComplete > 0,
        ).length;
        const completed = c.enrollments.filter(
          (e) => e.completedAt != null,
        ).length;
        const avgPercent = enrolled
          ? round1(
              c.enrollments.reduce((s, e) => s + e.percentComplete, 0) /
                enrolled,
            )
          : 0;
        return {
          courseId: c.id,
          title: c.title,
          lessons: c._count.lessons,
          enrolled,
          notStarted: enrolled - started,
          inProgress: started - completed,
          completed,
          avgPercent,
          completionRate: enrolled ? round1((completed / enrolled) * 100) : 0,
          dropOffRate: enrolled
            ? round1(((started - completed) / enrolled) * 100)
            : 0,
        };
      })
      .sort((a, b) => b.enrolled - a.enrolled);

    const enrolled = rows.reduce((s, r) => s + r.enrolled, 0);
    const started = rows.reduce((s, r) => s + (r.enrolled - r.notStarted), 0);
    const completed = rows.reduce((s, r) => s + r.completed, 0);
    return {
      from: this.dayKey(start),
      to: this.dayKey(end),
      courses: rows,
      totals: {
        enrolled,
        started,
        notStarted: enrolled - started,
        inProgress: started - completed,
        completed,
        completionRate: enrolled ? round1((completed / enrolled) * 100) : 0,
        dropOffRate: enrolled
          ? round1(((started - completed) / enrolled) * 100)
          : 0,
      },
    };
  }

  // CSV export of the daily time-series.
  async timeseriesCsv(from?: string, to?: string): Promise<string> {
    const data = await this.timeseries(from, to);
    const metrics = [
      "revenue",
      "orders",
      "signups",
      "enrollments",
      "lessonCompletions",
    ] as const;
    const byDate: Record<string, Record<string, number>> = {};
    for (const m of metrics) {
      for (const pt of data.series[m]) {
        byDate[pt.date] = byDate[pt.date] || {};
        byDate[pt.date][m] = pt.value;
      }
    }
    const header = ["date", ...metrics];
    const lines = Object.keys(byDate)
      .sort()
      .map((date) =>
        [date, ...metrics.map((m) => byDate[date][m] ?? 0)]
          .map((v) => this.csvEscape(v))
          .join(","),
      );
    return [header.join(","), ...lines].join("\n");
  }

  // CSV export of the per-course completion / drop-off funnel.
  async courseFunnelCsv(from?: string, to?: string): Promise<string> {
    const data = await this.courseFunnel(from, to);
    const header = [
      "courseId",
      "title",
      "lessons",
      "enrolled",
      "notStarted",
      "inProgress",
      "completed",
      "avgPercent",
      "completionRate",
      "dropOffRate",
    ];
    const lines = data.courses.map((c) =>
      header.map((h) => this.csvEscape((c as any)[h])).join(","),
    );
    return [header.join(","), ...lines].join("\n");
  }
}
