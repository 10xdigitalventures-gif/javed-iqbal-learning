import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  private webBase() {
    return process.env.PUBLIC_WEB_URL || "http://localhost:3000";
  }

  // Human-friendly, unguessable serial: JI-XXXX-XXXX-XXXX (Crockford base32).
  private newSerial() {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const bytes = randomBytes(12);
    let out = "";
    for (let i = 0; i < 12; i++) {
      out += alphabet[bytes[i] % alphabet.length];
      if (i === 3 || i === 7) out += "-";
    }
    return "JI-" + out;
  }

  private async uniqueSerial(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const serial = this.newSerial();
      const clash = await this.prisma.certificate.findUnique({
        where: { serial },
      });
      if (!clash) return serial;
    }
    // Extremely unlikely fallback.
    return "JI-" + Date.now().toString(36).toUpperCase();
  }

  // Issue a certificate the first time a course is completed. Idempotent:
  // returns the existing certificate if one was already granted.
  async ensureForCompletion(userId: string, courseId: string) {
    const existing = await this.prisma.certificate.findFirst({
      where: { userId, courseId },
    });
    if (existing) return existing;
    const serial = await this.uniqueSerial();
    return this.prisma.certificate.create({
      data: { userId, courseId, serial },
    });
  }

  // Manual issue (client). Only allowed once the course is fully completed.
  async issueForUser(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException("You are not enrolled in this course");
    }
    const done =
      enrollment.percentComplete >= 100 || enrollment.completedAt != null;
    if (!done) {
      throw new BadRequestException(
        "Complete the course before requesting a certificate",
      );
    }
    return this.ensureForCompletion(userId, courseId);
  }

  async myCertificates(userId: string) {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      include: {
        course: { select: { id: true, title: true, slug: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      serial: c.serial,
      issuedAt: c.issuedAt,
      courseId: c.courseId,
      courseTitle: c.course?.title ?? "Course",
      verifyUrl: this.webBase() + "/verify/" + c.serial,
    }));
  }

  // Full certificate detail for the owner (used by the printable view).
  async getForOwner(id: string, userId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!cert) throw new NotFoundException("Certificate not found");
    if (cert.userId !== userId) {
      throw new ForbiddenException("This certificate belongs to another user");
    }
    return {
      id: cert.id,
      serial: cert.serial,
      issuedAt: cert.issuedAt,
      holderName: cert.user?.name ?? "Student",
      courseTitle: cert.course?.title ?? "Course",
      verifyUrl: this.webBase() + "/verify/" + cert.serial,
    };
  }

  // PUBLIC verification by serial. Never throws for an unknown serial — the
  // public page renders an "invalid" state instead.
  async verify(serial: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { serial },
      include: {
        course: { select: { title: true } },
        user: { select: { name: true } },
      },
    });
    if (!cert) {
      return { valid: false as const, serial };
    }
    return {
      valid: true as const,
      serial: cert.serial,
      holderName: cert.user?.name ?? "Student",
      courseTitle: cert.course?.title ?? "Course",
      issuedAt: cert.issuedAt,
      verifyUrl: this.webBase() + "/verify/" + cert.serial,
    };
  }
}
