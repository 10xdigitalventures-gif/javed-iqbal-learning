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

// Message types that carry an uploaded attachment (require a media key).
const MEDIA_TYPES: MessageType[] = [
  MessageType.AUDIO,
  MessageType.VIDEO,
  MessageType.IMAGE,
  MessageType.FILE,
];

// Prisma include used everywhere a full message is returned (reactions + the
// message it replies to).
const MESSAGE_INCLUDE = {
  reactions: true,
  replyTo: {
    include: { sender: { select: { id: true, name: true } } },
  },
} as const;

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
  private withSignedMedia<T extends { mediaUrl?: string | null }>(
    message: T,
  ): T {
    if (!message?.mediaUrl) return message;
    return { ...message, mediaUrl: this.storage.signedUrl(message.mediaUrl) };
  }

  // Sign the message media and (if present) the quoted reply's media too.
  private serialize<T extends { mediaUrl?: string | null; replyTo?: any }>(
    message: T,
  ): T {
    const signed: any = this.withSignedMedia(message);
    if (signed.replyTo) signed.replyTo = this.withSignedMedia(signed.replyTo);
    return signed;
  }

  // Get (or create) the single conversation between a client and consultant.
  async startConversation(clientId: string, consultantId: string) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT, isActive: true },
    });
    if (!client)
      throw new ForbiddenException(
        "Only active clients can start conversations",
      );

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
    // Messages the user can now see (their inbox is open) become "delivered".
    if (user.role === Role.CLIENT || user.role === Role.CONSULTANT) {
      await this.prisma.message.updateMany({
        where: {
          conversation: where,
          senderId: { not: user.userId },
          status: MessageStatus.SENT,
        },
        data: { status: MessageStatus.DELIVERED },
      });
    }
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
        purchase: { select: { consultationMode: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: MESSAGE_INCLUDE,
        },
      },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    return {
      ...convo,
      messages: convo.messages.map((m) => this.serialize(m)),
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
    let clientPurchase: any = null;

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
      // Enforce the per-package word limit for text messages.
      if (
        dto.type === MessageType.TEXT &&
        purchase.textWordLimit != null &&
        dto.body
      ) {
        const words = dto.body.trim().split(/\s+/).filter(Boolean).length;
        if (words > purchase.textWordLimit) {
          throw new BadRequestException(
            `Text message exceeds the ${purchase.textWordLimit}-word limit for your package.`,
          );
        }
      }
      purchaseId = purchase.id;
      clientPurchase = purchase;
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
    if (MEDIA_TYPES.includes(dto.type) && !mediaKey) {
      throw new BadRequestException(`${dto.type} message requires mediaKey`);
    }

    // Validate the quoted message belongs to this same conversation.
    if (dto.replyToId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
      });
      if (!parent || parent.conversationId !== conversationId) {
        throw new BadRequestException("Cannot reply to that message");
      }
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.userId,
        purchaseId,
        type: dto.type,
        body: dto.body,
        mediaUrl: mediaKey,
        fileName: dto.fileName ?? null,
        durationSec: dto.durationSec,
        replyToId: dto.replyToId ?? null,
        status: MessageStatus.SENT,
      },
      include: MESSAGE_INCLUDE,
    });

    if (purchaseId) await this.usage.consume(purchaseId, kind);

    // Advance the "Book a Chat" (SINGLE) consultation status workflow. Ongoing
    // CHAT conversations keep their ACTIVE status untouched.
    const convUpdate: any = { lastMessageAt: new Date() };
    if (user.role === Role.CLIENT) {
      if (purchaseId && !convo.purchaseId) convUpdate.purchaseId = purchaseId;
      const mode =
        clientPurchase?.consultationMode ??
        (await this.modeForConversation(convo));
      if (mode === "SINGLE") convUpdate.status = "MESSAGE_SUBMITTED";
    } else if (user.role === Role.CONSULTANT) {
      const mode = await this.modeForConversation(convo);
      if (mode === "SINGLE") convUpdate.status = "RESPONSE_SENT";
    }
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: convUpdate,
    });

    // Push the new message to both participants in real time (SSE) with a
    // signed media URL so the recipient can play it immediately.
    const signed = this.serialize(message);
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
      body:
        dto.type === MessageType.TEXT
          ? dto.body
          : `New ${dto.type.toLowerCase()} message`,
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
    // A consultant opening a submitted single-consultation moves it to review.
    if (user.role === Role.CONSULTANT && convo.status === "MESSAGE_SUBMITTED") {
      const mode = await this.modeForConversation(convo);
      if (mode === "SINGLE") {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: "UNDER_REVIEW" },
        });
      }
    }
    // A client reading the consultant's response auto-closes the single
    // consultation; the client is then prompted for feedback in the app.
    if (user.role === Role.CLIENT && convo.status === "RESPONSE_SENT") {
      const mode = await this.modeForConversation(convo);
      if (mode === "SINGLE") {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: "CLOSED" },
        });
        for (const participantId of [convo.clientId, convo.consultantId]) {
          this.realtime.emit(participantId, "conversation:status", {
            conversationId,
            status: "CLOSED",
          });
        }
      }
    }
    return { ok: true };
  }

  // Edit the text body of one's own message.
  async editMessage(
    user: AuthUser,
    conversationId: string,
    messageId: string,
    body: string,
  ) {
    const { convo, message } = await this.loadOwnMessage(
      user,
      conversationId,
      messageId,
    );
    if (message.type !== MessageType.TEXT)
      throw new BadRequestException("Only text messages can be edited");
    if (message.deletedAt)
      throw new BadRequestException("Cannot edit a deleted message");
    if (!body?.trim())
      throw new BadRequestException("Message body is required");
    if (body.length > TEXT_CHAR_LIMIT)
      throw new BadRequestException(
        "Text message exceeds the " + TEXT_CHAR_LIMIT + "-character limit.",
      );

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
    const signed = this.serialize(updated);
    for (const participantId of [convo.clientId, convo.consultantId]) {
      this.realtime.emit(participantId, "message:update", {
        conversationId,
        message: signed,
      });
    }
    return signed;
  }

  // Soft-delete one's own message (kept as a "message deleted" placeholder).
  async deleteMessage(
    user: AuthUser,
    conversationId: string,
    messageId: string,
  ) {
    const { convo } = await this.loadOwnMessage(
      user,
      conversationId,
      messageId,
    );
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        body: null,
        mediaUrl: null,
        fileName: null,
      },
      include: MESSAGE_INCLUDE,
    });
    const signed = this.serialize(updated);
    for (const participantId of [convo.clientId, convo.consultantId]) {
      this.realtime.emit(participantId, "message:update", {
        conversationId,
        message: signed,
      });
    }
    return signed;
  }

  // Toggle an emoji reaction by the current user on a message.
  async reactToMessage(
    user: AuthUser,
    conversationId: string,
    messageId: string,
    emoji: string,
  ) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.conversationId !== conversationId)
      throw new NotFoundException("Message not found");
    if (!emoji?.trim()) throw new BadRequestException("Emoji is required");

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId: user.userId, emoji },
      },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId: user.userId, emoji },
      });
    }
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
    });
    for (const participantId of [convo.clientId, convo.consultantId]) {
      this.realtime.emit(participantId, "message:reaction", {
        conversationId,
        messageId,
        reactions,
      });
    }
    return reactions;
  }

  // Broadcast a transient typing indicator to the other participant (no DB).
  async setTyping(user: AuthUser, conversationId: string, typing: boolean) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    const otherId =
      user.userId === convo.clientId ? convo.consultantId : convo.clientId;
    this.realtime.emit(otherId, "typing", {
      conversationId,
      userId: user.userId,
      typing,
    });
    return { ok: true };
  }

  // Load a message and assert the current user is its sender + a participant.
  private async loadOwnMessage(
    user: AuthUser,
    conversationId: string,
    messageId: string,
  ) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.conversationId !== conversationId)
      throw new NotFoundException("Message not found");
    if (message.senderId !== user.userId)
      throw new ForbiddenException("You can only modify your own messages");
    return { convo, message };
  }

  // Resolve the consultation mode (CHAT/SINGLE) for a conversation via its
  // linked purchase. Unlinked conversations are treated as ongoing CHAT.
  private async modeForConversation(convo: {
    purchaseId: string | null;
  }): Promise<string> {
    if (!convo.purchaseId) return "CHAT";
    const p = await this.prisma.purchase.findUnique({
      where: { id: convo.purchaseId },
      select: { consultationMode: true },
    });
    return p?.consultationMode ?? "CHAT";
  }

  // Close a consultation (consultant or admin participant). Marks it CLOSED and
  // notifies both participants in real time.
  async closeConsultation(user: AuthUser, conversationId: string) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "CLOSED" },
    });
    for (const participantId of [convo.clientId, convo.consultantId]) {
      this.realtime.emit(participantId, "conversation:status", {
        conversationId,
        status: "CLOSED",
      });
    }
    return updated;
  }

  // Client feedback for a completed single consultation (rating 1-5 + comment).
  // Submitting feedback also closes the consultation.
  async submitFeedback(
    user: AuthUser,
    conversationId: string,
    rating: number,
    comment?: string,
  ) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!convo) throw new NotFoundException("Conversation not found");
    assertParticipant(user, convo.clientId, convo.consultantId);
    if (user.userId !== convo.clientId)
      throw new ForbiddenException("Only the client can leave feedback");
    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        feedbackRating: clamped,
        feedbackComment: comment?.trim() || null,
        feedbackAt: new Date(),
        status: "CLOSED",
      },
    });
    this.realtime.emit(convo.consultantId, "conversation:feedback", {
      conversationId,
      rating: clamped,
    });
    return updated;
  }

  private kindOf(type: MessageType): "text" | "audio" | "video" {
    if (type === MessageType.AUDIO) return "audio";
    if (type === MessageType.VIDEO) return "video";
    return "text";
  }
}
