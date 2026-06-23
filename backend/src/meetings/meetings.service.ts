import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MeetingStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsageService } from "../purchases/usage.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../common/access";
import {
  BookMeetingDto,
  RescheduleDto,
  SetAvailabilityDto,
} from "./dto";

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private usage: UsageService,
    private notifications: NotificationsService,
  ) {}

  // --- Availability ---
  getAvailability(consultantId: string) {
    return this.prisma.availability.findMany({
      where: { consultantId, isActive: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  async setAvailability(consultantId: string, dto: SetAvailabilityDto) {
    await this.prisma.availability.deleteMany({ where: { consultantId } });
    if (dto.slots.length === 0) return [];
    await this.prisma.availability.createMany({
      data: dto.slots.map((s) => ({
        consultantId,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
    return this.getAvailability(consultantId);
  }

  // --- Booking ---
  async book(clientId: string, dto: BookMeetingDto) {
    const consultant = await this.prisma.user.findFirst({
      where: { id: dto.consultantId, role: Role.CONSULTANT, isActive: true },
    });
    if (!consultant) throw new NotFoundException("Consultant not found");

    // If a purchase is provided, ensure it has a session allowance.
    let purchaseId: string | null = dto.purchaseId ?? null;
    if (!purchaseId) {
      const usable = await this.usage.findUsablePurchase(
        clientId,
        dto.consultantId,
        "session",
      );
      purchaseId = usable?.id ?? null;
    } else {
      const p = await this.usage.getOrThrow(purchaseId);
      if (p.clientId !== clientId || (p.consultantId && p.consultantId !== dto.consultantId))
        throw new ForbiddenException("This package cannot be used for the selected consultant");
      if (p.status !== "ACTIVE")
        throw new BadRequestException("Package is not active yet");
      if (!this.usage.hasRoom(p, "session"))
        throw new BadRequestException("No remaining sessions in this package");
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        clientId,
        consultantId: dto.consultantId,
        purchaseId,
        title: dto.title,
        scheduledAt: new Date(dto.scheduledAt),
        durationMin: dto.durationMin ?? (purchaseId ? (await this.usage.getOrThrow(purchaseId)).sessionDuration ?? 30 : 30),
        notes: dto.notes,
        status: MeetingStatus.REQUESTED,
      },
    });

    await this.notifications.create(dto.consultantId, {
      type: "NEW_BOOKING",
      title: "New meeting request",
      body: `${dto.title} — awaiting your approval`,
      email: true,
    });
    return meeting;
  }

  async approve(user: AuthUser, id: string, meetingUrl?: string) {
    const meeting = await this.getOwned(user, id);
    if (user.role === Role.CLIENT)
      throw new ForbiddenException("Only the consultant or admin can approve");
    if (meeting.status === MeetingStatus.APPROVED)
      throw new BadRequestException("Meeting is already approved");
    if (meeting.purchaseId) {
      const purchase = await this.usage.getOrThrow(meeting.purchaseId);
      if (!this.usage.hasRoom(purchase, "session"))
        throw new BadRequestException("No remaining sessions in this package");
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.APPROVED,
        meetingUrl: meetingUrl ?? meeting.meetingUrl,
      },
    });
    if (meeting.purchaseId) await this.usage.consume(meeting.purchaseId, "session");
    await this.notifications.create(meeting.clientId, {
      type: "BOOKING_APPROVED",
      title: "Meeting approved",
      body: `${meeting.title} is confirmed`,
      email: true,
    });
    return updated;
  }

  async reject(user: AuthUser, id: string) {
    const meeting = await this.getOwned(user, id);
    if (meeting.status === MeetingStatus.APPROVED)
      throw new BadRequestException("Meeting is already approved");
    if (meeting.purchaseId) {
      const purchase = await this.usage.getOrThrow(meeting.purchaseId);
      if (!this.usage.hasRoom(purchase, "session"))
        throw new BadRequestException("No remaining sessions in this package");
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.REJECTED },
    });
    await this.notifications.create(meeting.clientId, {
      type: "BOOKING_REJECTED",
      title: "Meeting declined",
      body: `${meeting.title} was declined`,
      email: true,
    });
    return updated;
  }

  async reschedule(user: AuthUser, id: string, dto: RescheduleDto) {
    const meeting = await this.getOwned(user, id);
    return this.prisma.meeting.update({
      where: { id },
      data: {
        scheduledAt: new Date(dto.scheduledAt),
        durationMin: dto.durationMin ?? meeting.durationMin,
        status: MeetingStatus.REQUESTED,
      },
    });
  }

  async cancel(user: AuthUser, id: string) {
    await this.getOwned(user, id);
    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async complete(user: AuthUser, id: string) {
    await this.getOwned(user, id);
    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.COMPLETED },
    });
  }

  list(user: AuthUser, upcoming?: boolean) {
    const base: any =
      user.role === Role.CONSULTANT
        ? { consultantId: user.userId }
        : user.role === Role.CLIENT
          ? { clientId: user.userId }
          : {};
    if (upcoming) base.scheduledAt = { gte: new Date() };
    return this.prisma.meeting.findMany({
      where: base,
      include: {
        client: { select: { id: true, name: true } },
        consultant: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  private async getOwned(user: AuthUser, id: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException("Meeting not found");
    if (
      user.role !== Role.ADMIN &&
      meeting.clientId !== user.userId &&
      meeting.consultantId !== user.userId
    )
      throw new ForbiddenException("Not your meeting");
    return meeting;
  }
}
