import { Injectable } from "@nestjs/common";
import { OrderStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityEventDto } from "./dto";

// Central analytics + activity log. Every learning action funnels through
// log(); the mobile app batches offline events and replays them via syncBatch()
// when connectivity returns. Admin dashboards read the aggregate helpers.
@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  log(userId: string | null, event: ActivityEventDto, ip?: string) {
    return this.prisma.activityLog.create({
      data: {
        userId: userId ?? undefined,
        action: event.action,
        meta: event.meta
          ? JSON.stringify({
              ...event.meta,
              at: event.at ?? Date.now(),
            })
          : event.at
            ? JSON.stringify({ at: event.at })
            : null,
        ip: ip ?? null,
      },
    });
  }

  // Replay a batch of offline-captured events in chronological order. Returns
  // how many were stored so the client can clear its local queue.
  async syncBatch(userId: string, events: ActivityEventDto[], ip?: string) {
    const ordered = [...events].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    let synced = 0;
    for (const event of ordered) {
      await this.log(userId, event, ip);
      synced++;
    }
    return { synced };
  }

  recentForUser(userId: string, take = 50) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  // ---- Admin analytics ----
  async overview() {
    const [
      users,
      books,
      bundles,
      paidOrders,
      activeSubs,
      hardCopyPending,
      readers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.book.count(),
      this.prisma.bundle.count(),
      this.prisma.order.findMany({
        where: { status: OrderStatus.PAID },
        select: { amount: true, currency: true },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.hardCopyOrder.count({ where: { status: "PENDING" } }),
      this.prisma.readingProgress.count(),
    ]);
    const revenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
    return {
      users,
      books,
      bundles,
      paidOrders: paidOrders.length,
      revenue,
      activeSubscriptions: activeSubs,
      hardCopyPending,
      activeReaders: readers,
    };
  }

  // Aggregate reading engagement across the platform.
  async readingAnalytics() {
    const progress = await this.prisma.readingProgress.findMany({
      include: { book: { select: { title: true } } },
    });
    const totalSeconds = progress.reduce((s, p) => s + p.readingSeconds, 0);
    const completed = progress.filter((p) => p.isCompleted).length;
    const avgPercent = progress.length
      ? progress.reduce((s, p) => s + p.percentComplete, 0) / progress.length
      : 0;
    // Most-read books by aggregate reading time.
    const byBook = new Map<string, number>();
    for (const p of progress) {
      byBook.set(
        p.book.title,
        (byBook.get(p.book.title) ?? 0) + p.readingSeconds,
      );
    }
    const topBooks = [...byBook.entries()]
      .map(([title, seconds]) => ({ title, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 10);
    return {
      totalReadingSeconds: totalSeconds,
      totalReadingHours: Math.round((totalSeconds / 3600) * 10) / 10,
      booksInProgress: progress.length,
      booksCompleted: completed,
      averageCompletion: Math.round(avgPercent * 10) / 10,
      topBooks,
    };
  }

  // A single user's learning footprint, for the admin user detail view.
  async userAnalytics(userId: string) {
    const [entitlements, progress, orders, logs] = await Promise.all([
      this.prisma.entitlement.count({ where: { userId, isActive: true } }),
      this.prisma.readingProgress.findMany({
        where: { userId },
        include: { book: { select: { title: true } } },
      }),
      this.prisma.order.count({
        where: { userId, status: OrderStatus.PAID },
      }),
      this.recentForUser(userId, 30),
    ]);
    return {
      ownedBooks: entitlements,
      paidOrders: orders,
      readingProgress: progress,
      recentActivity: logs,
    };
  }
}
