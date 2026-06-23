import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { RealtimeService } from "../realtime/realtime.service";
import { PushService } from "./push.service";

type CreateNotif = {
  type: string;
  title: string;
  body?: string;
  email?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private realtime: RealtimeService,
    private push: PushService,
  ) {}

  async create(userId: string, n: CreateNotif) {
    const notif = await this.prisma.notification.create({
      data: {
        userId,
        channel: NotificationChannel.IN_APP,
        type: n.type,
        title: n.title,
        body: n.body,
      },
    });

    // Real-time in-app push over SSE.
    this.realtime.emit(userId, "notification", {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      createdAt: notif.createdAt,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (n.email && user) {
      await this.mail.send(user.email, n.title, n.body || n.title);
    }
    // Mobile push notification (best-effort).
    if (user?.pushToken) {
      await this.push.send(user.pushToken, n.title, n.body || n.title, {
        type: n.type,
      });
    }
    return notif;
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
