import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { RealtimeService } from "../realtime/realtime.service";
import { PushService } from "./push.service";
import { SmsService } from "./sms.service";

type CreateNotif = {
  type: string;
  title: string;
  body?: string;
  // When true, the notification is "important" and is also delivered over the
  // user's enabled external channels (email / SMS / WhatsApp). In-app + push
  // are governed purely by the user's preferences.
  email?: boolean;
};

// Default preference shape used before a user has saved any choices.
const DEFAULT_PREF = {
  inApp: true,
  email: true,
  sms: false,
  whatsapp: false,
  push: true,
  mutedTypes: [] as string[],
};

export type UpdatePreferenceInput = {
  inApp?: boolean;
  email?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  push?: boolean;
  mutedTypes?: string[];
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private realtime: RealtimeService,
    private push: PushService,
    private sms: SmsService,
  ) {}

  // Returns the user's saved preferences, or sensible defaults if none exist.
  async getPreference(userId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (pref) return pref;
    return { userId, ...DEFAULT_PREF };
  }

  // Upsert the user's preferences.
  async updatePreference(userId: string, input: UpdatePreferenceInput) {
    const data: any = {};
    for (const key of ["inApp", "email", "sms", "whatsapp", "push"] as const) {
      if (typeof input[key] === "boolean") data[key] = input[key];
    }
    if (Array.isArray(input.mutedTypes)) data.mutedTypes = input.mutedTypes;
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...DEFAULT_PREF, ...data },
    });
  }

  async create(userId: string, n: CreateNotif) {
    const pref = await this.getPreference(userId);
    const muted = pref.mutedTypes.includes(n.type);

    // Always persist the in-app record so the notification history is complete,
    // regardless of channel preferences.
    const notif = await this.prisma.notification.create({
      data: {
        userId,
        channel: NotificationChannel.IN_APP,
        type: n.type,
        title: n.title,
        body: n.body,
      },
    });

    // Real-time in-app push over SSE (suppressed if muted or in-app disabled).
    if (pref.inApp && !muted) {
      this.realtime.emit(userId, "notification", {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        createdAt: notif.createdAt,
      });
    }

    if (muted) return notif;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notif;

    const text = n.body || n.title;
    const line = n.body ? n.title + ": " + n.body : n.title;

    // External channels are only used for "important" notifications (email flag)
    // and only when the user has opted into that channel.
    if (n.email) {
      if (pref.email) {
        await this.mail.send(user.email, n.title, text);
      }
      if (pref.sms && user.phone) {
        await this.sms.sendSms(user.phone, line);
      }
      if (pref.whatsapp && user.phone) {
        await this.sms.sendWhatsapp(user.phone, line);
      }
    }

    // Mobile push (best-effort), gated by the push preference.
    if (pref.push && user.pushToken) {
      await this.push.send(user.pushToken, n.title, text, { type: n.type });
    }

    return notif;
  }

  // Resolve the set of user ids that match a broadcast segment.
  private async resolveRecipientIds(opts: {
    segment: string;
    tag?: string;
    since?: string;
    until?: string;
  }): Promise<string[]> {
    if (opts.segment === "tag") {
      const tag = (opts.tag || "").trim();
      if (!tag) return [];
      const users = await this.prisma.user.findMany({
        where: { isActive: true, tags: { has: tag } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (opts.segment === "purchase") {
      const createdAt: any = {};
      if (opts.since) createdAt.gte = new Date(opts.since);
      if (opts.until) createdAt.lte = new Date(opts.until);
      const purchases = await this.prisma.purchase.findMany({
        where: opts.since || opts.until ? { createdAt } : {},
        select: { clientId: true },
      });
      const ids = Array.from(new Set(purchases.map((p) => p.clientId)));
      if (ids.length === 0) return [];
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    // default: "all" active users
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // How many users a segment would reach (no notification is sent).
  async previewBroadcast(opts: {
    segment: string;
    tag?: string;
    since?: string;
    until?: string;
  }) {
    const ids = await this.resolveRecipientIds(opts);
    return { count: ids.length };
  }

  // Send an admin push/in-app notification to every user in a segment.
  async broadcast(opts: {
    title: string;
    body?: string;
    segment: string;
    tag?: string;
    since?: string;
    until?: string;
  }) {
    const ids = await this.resolveRecipientIds(opts);
    let sent = 0;
    for (const userId of ids) {
      try {
        await this.create(userId, {
          type: "announcement",
          title: opts.title,
          body: opts.body,
        });
        sent++;
      } catch {
        // best-effort per recipient
      }
    }
    return { recipients: ids.length, sent };
  }

  // Send a test notification to the user across all of their enabled channels
  // so they can verify their configuration.
  async sendTest(userId: string) {
    await this.create(userId, {
      type: "test",
      title: "Test notification",
      body: "This is a test from Prof. Dr. Javed Iqbal Learning App. If you can see this, your notifications are working.",
      email: true,
    });
    return { ok: true };
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true };
  }
}
