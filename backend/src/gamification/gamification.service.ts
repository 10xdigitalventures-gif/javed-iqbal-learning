import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type BadgeMetric =
  "lessons" | "courses" | "reviews" | "streak" | "points";

export type BadgeDef = {
  key: string;
  name: string;
  description: string;
  icon: string;
  metric: BadgeMetric;
  threshold: number;
};

// Simple, deterministic points economy.
const POINTS_PER_LESSON = 10;
const POINTS_PER_COURSE = 50;
const POINTS_PER_REVIEW = 15;
const POINTS_PER_STREAK_DAY = 5;

type Metrics = {
  lessons: number;
  courses: number;
  reviews: number;
  streak: number;
  longestStreak: number;
  points: number;
};

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  // Badge catalogue. Earned UserBadge rows reference these entries by `key`, so
  // badge metadata (name/icon/criteria) can evolve without a data migration.
  static readonly BADGES: BadgeDef[] = [
    {
      key: "first_lesson",
      name: "First Steps",
      description: "Complete your first lesson",
      icon: "\uD83C\uDFAF",
      metric: "lessons",
      threshold: 1,
    },
    {
      key: "ten_lessons",
      name: "Getting Serious",
      description: "Complete 10 lessons",
      icon: "\uD83D\uDCDA",
      metric: "lessons",
      threshold: 10,
    },
    {
      key: "fifty_lessons",
      name: "Scholar",
      description: "Complete 50 lessons",
      icon: "\uD83C\uDFC5",
      metric: "lessons",
      threshold: 50,
    },
    {
      key: "first_course",
      name: "Course Crusher",
      description: "Finish your first course",
      icon: "\uD83C\uDF93",
      metric: "courses",
      threshold: 1,
    },
    {
      key: "five_courses",
      name: "Lifelong Learner",
      description: "Finish 5 courses",
      icon: "\uD83D\uDC51",
      metric: "courses",
      threshold: 5,
    },
    {
      key: "first_review",
      name: "Critic",
      description: "Write your first course review",
      icon: "\u270D\uFE0F",
      metric: "reviews",
      threshold: 1,
    },
    {
      key: "streak_3",
      name: "Warming Up",
      description: "Keep a 3-day learning streak",
      icon: "\uD83D\uDD25",
      metric: "streak",
      threshold: 3,
    },
    {
      key: "streak_7",
      name: "On Fire",
      description: "Keep a 7-day learning streak",
      icon: "\uD83D\uDD25",
      metric: "streak",
      threshold: 7,
    },
    {
      key: "streak_30",
      name: "Unstoppable",
      description: "Keep a 30-day learning streak",
      icon: "\u26A1",
      metric: "streak",
      threshold: 30,
    },
    {
      key: "points_500",
      name: "High Achiever",
      description: "Earn 500 points",
      icon: "\u2B50",
      metric: "points",
      threshold: 500,
    },
    {
      key: "points_1000",
      name: "Legend",
      description: "Earn 1000 points",
      icon: "\uD83C\uDF1F",
      metric: "points",
      threshold: 1000,
    },
  ];

  // ---- internal helpers ----

  private async getOrCreateStat(userId: string) {
    const existing = await this.prisma.userGameStat.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    return this.prisma.userGameStat.create({ data: { userId } });
  }

  // Activity counts (and derived points) that drive badges + the leaderboard.
  private async metricsFor(
    userId: string,
    stat: {
      currentStreak: number;
      longestStreak: number;
      bonusPoints?: number;
    },
  ): Promise<Metrics> {
    const [lessons, courses, reviews] = await Promise.all([
      this.prisma.lessonCompletion.count({ where: { userId } }),
      this.prisma.certificate.count({ where: { userId } }),
      this.prisma.courseReview.count({ where: { userId } }),
    ]);
    const points =
      lessons * POINTS_PER_LESSON +
      courses * POINTS_PER_COURSE +
      reviews * POINTS_PER_REVIEW +
      (stat.longestStreak || 0) * POINTS_PER_STREAK_DAY +
      (stat.bonusPoints || 0);
    return {
      lessons,
      courses,
      reviews,
      streak: stat.currentStreak || 0,
      longestStreak: stat.longestStreak || 0,
      points,
    };
  }

  private metricValue(m: Metrics, def: BadgeDef): number {
    switch (def.metric) {
      case "lessons":
        return m.lessons;
      case "courses":
        return m.courses;
      case "reviews":
        return m.reviews;
      case "streak":
        return m.longestStreak;
      case "points":
        return m.points;
      default:
        return 0;
    }
  }

  // Persist any newly-earned badges (idempotent).
  private async syncBadges(userId: string, metrics: Metrics) {
    const earned = await this.prisma.userBadge.findMany({ where: { userId } });
    const earnedKeys = new Set(earned.map((b) => b.badgeKey));
    const toAward = GamificationService.BADGES.filter(
      (def) =>
        !earnedKeys.has(def.key) &&
        this.metricValue(metrics, def) >= def.threshold,
    );
    for (const def of toAward) {
      try {
        await this.prisma.userBadge.create({
          data: { userId, badgeKey: def.key },
        });
      } catch {
        // ignore unique-constraint race
      }
    }
  }

  // Cache points on the stat row so the leaderboard is a single cheap query.
  private async cachePoints(userId: string, points: number) {
    await this.prisma.userGameStat
      .update({ where: { userId }, data: { points } })
      .catch(() => undefined);
  }

  // Grant ad-hoc bonus points (e.g. referral rewards). Increments the
  // stored bonus and the cached leaderboard total immediately.
  // Idempotency is the caller's responsibility.
  async awardBonusPoints(userId: string, points: number) {
    if (!points || points <= 0) return;
    await this.getOrCreateStat(userId);
    return this.prisma.userGameStat.update({
      where: { userId },
      data: {
        bonusPoints: { increment: points },
        points: { increment: points },
      },
    });
  }

  // ---- public API ----

  // Full gamification profile for the signed-in learner. Recomputes metrics,
  // awards any due badges, and refreshes the cached points.
  async getProfile(userId: string) {
    const stat = await this.getOrCreateStat(userId);
    const metrics = await this.metricsFor(userId, stat);
    await this.syncBadges(userId, metrics);
    await this.cachePoints(userId, metrics.points);

    const earned = await this.prisma.userBadge.findMany({ where: { userId } });
    const earnedMap = new Map(
      earned.map((b) => [b.badgeKey, b.earnedAt] as const),
    );
    const badges = GamificationService.BADGES.map((def) => {
      const current = this.metricValue(metrics, def);
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        metric: def.metric,
        threshold: def.threshold,
        current,
        progress: Math.min(1, def.threshold ? current / def.threshold : 1),
        earned: earnedMap.has(def.key),
        earnedAt: earnedMap.get(def.key) ?? null,
      };
    });

    return {
      points: metrics.points,
      currentStreak: stat.currentStreak || 0,
      longestStreak: stat.longestStreak || 0,
      lastActiveDay: stat.lastActiveDay,
      stats: {
        lessons: metrics.lessons,
        courses: metrics.courses,
        reviews: metrics.reviews,
      },
      badges,
      earnedCount: earned.length,
      totalBadges: GamificationService.BADGES.length,
    };
  }

  // Daily check-in: extends the streak when called on consecutive local days,
  // resets it otherwise, and never double-counts the same day.
  async checkIn(userId: string, day?: string) {
    const today = this.normalizeDay(day) || this.serverDay();
    const stat = await this.getOrCreateStat(userId);

    let currentStreak = stat.currentStreak || 0;
    if (stat.lastActiveDay === today) {
      // already counted today - no streak change
    } else if (
      stat.lastActiveDay &&
      this.isYesterday(stat.lastActiveDay, today)
    ) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    const longestStreak = Math.max(stat.longestStreak || 0, currentStreak);

    await this.prisma.userGameStat.update({
      where: { userId },
      data: { currentStreak, longestStreak, lastActiveDay: today },
    });

    return this.getProfile(userId);
  }

  // Top learners by cached points. Refreshes the caller's own cache first so
  // they always see an up-to-date position for themselves.
  async leaderboard(userId: string, limit = 20) {
    await this.getProfile(userId).catch(() => undefined);
    const take = Math.min(Math.max(Math.floor(limit) || 20, 1), 100);
    const top = await this.prisma.userGameStat.findMany({
      orderBy: [{ points: "desc" }, { longestStreak: "desc" }],
      take,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const rows = top
      .filter((s) => !!s.user)
      .map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        name: s.user?.name ?? "Learner",
        avatarUrl: s.user?.avatarUrl ?? null,
        points: s.points,
        currentStreak: s.currentStreak,
        isMe: s.userId === userId,
      }));
    const me = rows.find((r) => r.isMe) ?? null;
    return { rows, me };
  }

  // ---- date helpers (operate on YYYY-MM-DD strings) ----

  private serverDay(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeDay(day?: string): string | null {
    if (!day) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day.trim());
    return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
  }

  private isYesterday(prev: string, today: string): boolean {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10) === prev;
  }
}
