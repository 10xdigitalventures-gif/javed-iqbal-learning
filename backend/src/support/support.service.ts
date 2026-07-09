import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role, SupportTicketStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/access";
import { CreateTicketDto, ReplyTicketDto, UpdateTicketStatusDto } from "./dto";

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // Any authenticated user (client or consultant) opens a ticket. The first
  // message is stored as the opening message of the thread.
  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject.trim(),
        category: dto.category,
        status: SupportTicketStatus.OPEN,
        lastReplyAt: new Date(),
        messages: {
          create: {
            senderId: userId,
            body: dto.message.trim(),
            isStaff: false,
          },
        },
      },
      include: { messages: true },
    });
  }

  listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { lastReplyAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
  }

  listAll(status?: string) {
    const where =
      status && status in SupportTicketStatus
        ? { status: status as SupportTicketStatus }
        : undefined;
    return this.prisma.supportTicket.findMany({
      where,
      orderBy: { lastReplyAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (user.role !== Role.ADMIN && ticket.userId !== user.userId) {
      throw new ForbiddenException("You cannot view this ticket");
    }
    return ticket;
  }

  async reply(user: AuthUser, id: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const isStaff = user.role === Role.ADMIN;
    if (!isStaff && ticket.userId !== user.userId) {
      throw new ForbiddenException("You cannot reply to this ticket");
    }
    await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderId: user.userId,
        body: dto.body.trim(),
        isStaff,
      },
    });
    // A staff reply on a brand-new ticket moves it to IN_PROGRESS; a user reply
    // on a resolved/closed ticket reopens it. Otherwise status is unchanged.
    let next: SupportTicketStatus = ticket.status;
    if (isStaff && ticket.status === SupportTicketStatus.OPEN) {
      next = SupportTicketStatus.IN_PROGRESS;
    } else if (
      !isStaff &&
      (ticket.status === SupportTicketStatus.RESOLVED ||
        ticket.status === SupportTicketStatus.CLOSED)
    ) {
      next = SupportTicketStatus.OPEN;
    }
    await this.prisma.supportTicket.update({
      where: { id },
      data: { lastReplyAt: new Date(), status: next },
    });
    return this.get(user, id);
  }

  async setStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
