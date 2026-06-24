import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MessageStatus, MessageType, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsageService } from "../purchases/usage.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import { StorageService } from "../media/storage.service";
import { AuthUser, assertParticipant } from "../common/access";
import { SendMessageDto } from "./dto";

// App-wide hard cap on text message length (clients also enforce this in the UI).
const TEXT_CHAR_LIMIT = 2000;

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private usage: UsageService,
    private notifications: NotificationsService,
    private realtime: RealtimeService,
    private storage: StorageService,
  ) {}

  // Replace a message's stored media key with a freshly signed, expiring URL so
  // playback links never go stale (the DB only ever stores the stable key).
  private withSignedMedia<T extends { mediaUrl?: string | null }>(message: T): T {
    if (!message?.mediaUrl) return message;
    return { ...message, mediaUrl: this.storage.signedUrl(message.mediaUrl) };
  }

  // Get (or create) the single conversation between a client and consultant.
  async startConversation(clientId: string, consultantId: string) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT, isActive: true },
    });
    if (!client) throw new ForbiddenException("Only active clients can start conversations");

    const consultant = await this.prisma.user.findFirst({
      where: { id: consultantId, role: Role.CONSULTANT, isActive: true },
    });
    if (!consultant) throw new NotFoundException("Consultant not found");
    const existing = await this.prisma.conversation.findUnique({
      where: { clientId_consultantId: { clientId, consultantId } },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { clientId, consultantId },
    });
  }

  async listConversations(user: AuthUser) {
    const where =
      user.role === Role.CONSULTANT
        ? { consultantId: user.userId }
        : user.role === Role.CLIENT
          ? { clientId: user.userId }
          : {};
    const convos = await this.prisma.conversation.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, avatarUrl: true } },
        consultant: { select: { id: true, name: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });
    // Attach a signed last-message preview for the conversation list.
    return convos.map((c) => ({
      ...c,
      messages: c.messages.map((m) => this.withSignedMedia(m)),
    }));
  }

  async getConversation(user: AuthUser, conversationId: string) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        client: { select: { id: true, name: true, avatarUrl: true } },
        consultant: { select: { id: true, name: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    return {
      ...convo,
      messages: convo.messages.map((m) => this.withSignedMedia(m)),
    };
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);

    const kind = this.kindOf(dto.type);
    let purchaseId: string | null = null;

    // Clients consume their package allowances. Consultant replies are governed
    // by responseAllowance but kept simple here (replies always allowed).
    if (user.role === Role.CLIENT) {
      const purchase = await this.usage.findUsablePurchase(
        convo.clientId,
        convo.consultantId,
        kind,
      );
      if (!purchase)
        throw new ForbiddenException(
          `No active package with remaining ${dto.type.toLowerCase()} allowance. Please purchase a package.`,
        );

      // Enforce per-message duration limits for audio/video.
      const durLimit = this.usage.durationLimitFor(purchase, dto.type);
      if (
        durLimit != null &&
        dto.durationSec != null &&
        dto.durationSec > durLimit
      ) {
        throw new BadRequestException(
          `${dto.type} message exceeds the ${durLimit}s limit for your package.`,
        );
      }
      purchaseId = purchase.id;
    }

    if (dto.type === MessageType.TEXT && !dto.body?.trim()) {
      throw new BadRequestException("Text message body is required");
    }
    if (
      dto.type === MessageType.TEXT &&
      dto.body &&
      dto.body.length > TEXT_CHAR_LIMIT
    ) {
      throw new BadRequestException(
        "Text message exceeds the " + TEXT_CHAR_LIMIT + "-character limit.",
      );
    }
    // Persist the stable object key (never the transient signed URL). Prefer
    // mediaKey; fall back to normalising a full mediaUrl for older clients.
    const mediaKey =
      this.storage.extractKey(dto.mediaKey) ??
      this.storage.extractKey(dto.mediaUrl);
    if ((dto.type === MessageType.AUDIO || dto.type === MessageType.VIDEO) && !mediaKey) {
      throw new BadRequestException(`${dto.type} message requires mediaKey`);
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.userId,
        purchaseId,
        type: dto.type,
        body: dto.body,
        mediaUrl: mediaKey,
        durationSec: dto.durationSec,
        status: MessageStatus.SENT,
      },
    });

    if (purchaseId) await this.usage.consume(purchaseId, kind);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Push the new message to both participants in real time (SSE) with a
    // signed media URL so the recipient can play it immediately.
    const signed = this.withSignedMedia(message);
    for (const participantId of [convo.clientId, convo.consultantId]) {
      this.realtime.emit(participantId, "message", {
        conversationId,
        message: signed,
      });
    }

    // Notify the recipient.
    const recipientId =
      user.userId === convo.clientId ? convo.consultantId : convo.clientId;
    await this.notifications.create(recipientId, {
      type: "NEW_MESSAGE",
      title: "New message",
      body: dto.type === MessageType.TEXT ? dto.body : `New ${dto.type.toLowerCase()} message`,
      email: true,
    });

    return signed;
  }

  async markRead(user: AuthUser, conversationId: string) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.userId } },
      data: { status: MessageStatus.READ },
    });
    return { ok: true };
  }

  private kindOf(type: MessageType): "text" | "audio" | "video" {
    if (type === MessageType.AUDIO) return "audio";
    if (type === MessageType.VIDEO) return "video";
    return "text";
  }
}
