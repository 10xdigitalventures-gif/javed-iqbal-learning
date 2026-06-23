import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MessageType, PurchaseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Central usage-enforcement engine. Messaging & meetings call into this to
// check remaining allowances and to consume them atomically.
@Injectable()
export class UsageService {
  constructor(private prisma: PrismaService) {}

  // Find an ACTIVE, non-expired purchase for this client+consultant that still
  // has room for the requested resource. Returns null when none qualifies.
  async findUsablePurchase(
    clientId: string,
    consultantId: string,
    kind: "text" | "audio" | "video" | "session",
  ) {
    const now = new Date();
    const purchases = await this.prisma.purchase.findMany({
      where: {
        clientId,
        OR: [{ consultantId }, { consultantId: null }],
        status: PurchaseStatus.ACTIVE,
      },
      orderBy: { startedAt: "asc" },
    });
    for (const p of purchases) {
      if (p.expiresAt && p.expiresAt < now) continue;
      if (this.hasRoom(p, kind)) return p;
    }
    return null;
  }

  hasRoom(
    p: {
      textLimit: number | null;
      audioLimit: number | null;
      videoLimit: number | null;
      sessionLimit: number | null;
      textUsed: number;
      audioUsed: number;
      videoUsed: number;
      sessionsUsed: number;
    },
    kind: "text" | "audio" | "video" | "session",
  ): boolean {
    const map = {
      text: [p.textLimit, p.textUsed],
      audio: [p.audioLimit, p.audioUsed],
      video: [p.videoLimit, p.videoUsed],
      session: [p.sessionLimit, p.sessionsUsed],
    } as const;
    const [limit, used] = map[kind];
    if (limit === null || limit === undefined) return true; // unlimited
    return used < limit;
  }

  // Aggregate remaining allowance for a client with a given consultant across
  // all ACTIVE, non-expired purchases (consultant-specific + global). Powers the
  // chat composer's per-channel enable/disable state.
  //
  // For each channel the result reports:
  //   - allowed: whether the client can currently send on this channel
  //   - unlimited: whether at least one active plan grants unlimited use
  //   - remaining: total remaining units (null when unlimited)
  async remainingAllowance(clientId: string, consultantId: string) {
    const now = new Date();
    const purchases = await this.prisma.purchase.findMany({
      where: {
        clientId,
        OR: [{ consultantId }, { consultantId: null }],
        status: PurchaseStatus.ACTIVE,
      },
    });
    const active = purchases.filter((p) => !p.expiresAt || p.expiresAt >= now);

    const kinds = ["text", "audio", "video", "session"] as const;
    const result = {} as Record<
      (typeof kinds)[number],
      { allowed: boolean; unlimited: boolean; remaining: number | null }
    >;

    for (const kind of kinds) {
      let unlimited = false;
      let remaining = 0;
      let allowed = false;
      for (const p of active) {
        if (!this.hasRoom(p, kind)) continue;
        allowed = true;
        const limit = this.limitFor(p, kind);
        const used = this.usedFor(p, kind);
        if (limit === null || limit === undefined) {
          unlimited = true;
        } else {
          remaining += Math.max(0, limit - used);
        }
      }
      result[kind] = {
        allowed,
        unlimited,
        remaining: unlimited ? null : remaining,
      };
    }
    return result;
  }

  private limitFor(
    p: {
      textLimit: number | null;
      audioLimit: number | null;
      videoLimit: number | null;
      sessionLimit: number | null;
    },
    kind: "text" | "audio" | "video" | "session",
  ): number | null {
    return {
      text: p.textLimit,
      audio: p.audioLimit,
      video: p.videoLimit,
      session: p.sessionLimit,
    }[kind];
  }

  private usedFor(
    p: {
      textUsed: number;
      audioUsed: number;
      videoUsed: number;
      sessionsUsed: number;
    },
    kind: "text" | "audio" | "video" | "session",
  ): number {
    return {
      text: p.textUsed,
      audio: p.audioUsed,
      video: p.videoUsed,
      session: p.sessionsUsed,
    }[kind];
  }

  durationLimitFor(
    p: { audioDuration: number | null; videoDuration: number | null },
    type: MessageType,
  ): number | null {
    if (type === MessageType.AUDIO) return p.audioDuration ?? null;
    if (type === MessageType.VIDEO) return p.videoDuration ?? null;
    return null;
  }

  async consume(
    purchaseId: string,
    kind: "text" | "audio" | "video" | "session",
  ) {
    const field = {
      text: "textUsed",
      audio: "audioUsed",
      video: "videoUsed",
      session: "sessionsUsed",
    }[kind];
    return this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { [field]: { increment: 1 } },
    });
  }

  async getOrThrow(purchaseId: string) {
    const p = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!p) throw new NotFoundException("Purchase not found");
    return p;
  }

  assertOwner(
    purchase: { clientId: string; consultantId: string | null },
    userId: string,
  ) {
    if (purchase.clientId !== userId && purchase.consultantId !== userId)
      throw new ForbiddenException("Not your purchase");
  }
}
