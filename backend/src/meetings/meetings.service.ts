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



// ---------------------------------------------------------------------------
// Google Calendar / Meet auto-link
// Requires env vars: GOOGLE_SA_EMAIL, GOOGLE_SA_KEY (PEM private key, \n-escaped)
// GOOGLE_CALENDAR_DELEGATE – email of the calendar owner to impersonate
// All three must be set; if any is missing the feature is silently skipped.
// ---------------------------------------------------------------------------
async function createGoogleMeetLink(
  title: string,
  startIso: string,
  endIso: string,
): Promise<string | null> {
  try {
    const saEmail = process.env.GOOGLE_SA_EMAIL;
    const saKey = (process.env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n');
    const delegate = process.env.GOOGLE_CALENDAR_DELEGATE;
    if (!saEmail || !saKey || !delegate) return null;

    // Build JWT for service-account auth (RS256)
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: saEmail,
      sub: delegate,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const b64u = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = b64u(header) + '.' + b64u(payload);

    const { createSign } = await import('crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const sig = signer.sign(saKey, 'base64url');
    const jwt = unsigned + '.' + sig;

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) return null;

    // Create Calendar event with conferenceData (Google Meet)
    const reqId = `consulthub-${Date.now()}`;
    const eventRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          start: { dateTime: startIso },
          end: { dateTime: endIso },
          conferenceData: {
            createRequest: { requestId: reqId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
          },
        }),
      },
    );
    const event: any = await eventRes.json();
    return event?.hangoutLink || event?.conferenceData?.entryPoints?.[0]?.uri || null;
  } catch {
    return null;
  }
}
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

    // Auto-generate Google Meet link when not supplied manually.
    let resolvedUrl = meetingUrl ?? meeting.meetingUrl ?? null;
    if (!resolvedUrl && meeting.scheduledAt) {
      const start = meeting.scheduledAt;
      const end = new Date(start.getTime() + (meeting.durationMin || 60) * 60000);
      resolvedUrl = await createGoogleMeetLink(
        meeting.title,
        start.toISOString(),
        end.toISOString(),
      );
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.APPROVED,
        meetingUrl: resolvedUrl ?? meeting.meetingUrl,
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
