import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OtpPurpose, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { GhlSyncService } from "../ghl-sync/ghl-sync.service";
import { AttributionService } from "../attribution/attribution.service";
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";
import { randomBytes } from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private ghl: GhlSyncService,
    private attribution: AttributionService,
  ) {}

  private sign(
    user: { id: string; email: string; role: Role },
    deviceRowId?: string,
  ) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(deviceRowId ? { did: deviceRowId } : {}),
    });
  }

  // Type for the optional device info sent by mobile clients on auth.
  // Web clients can omit it (then no device row is created / enforced).
  private async registerDevice(
    userId: string,
    device?: { deviceId?: string; label?: string; platform?: string },
  ): Promise<string | undefined> {
    if (!device?.deviceId) return undefined;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { maxDevices: true },
    });
    const limit = Math.max(1, user?.maxDevices ?? 2);

    // Reuse the row for this physical device if it already exists.
    const existing = await this.prisma.userDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId: device.deviceId } },
    });
    const row = await this.prisma.userDevice.upsert({
      where: { userId_deviceId: { userId, deviceId: device.deviceId } },
      create: {
        userId,
        deviceId: device.deviceId,
        label: device.label ?? null,
        platform: device.platform ?? null,
      },
      update: {
        label: device.label ?? existing?.label ?? null,
        platform: device.platform ?? existing?.platform ?? null,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });

    // Enforce the concurrent device limit: if too many active devices, sign out
    // the oldest ones (Netflix/YouTube style) so the new login always works.
    const active = await this.prisma.userDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
    });
    if (active.length > limit) {
      const toRevoke = active.slice(limit); // keep newest `limit`, kick the rest
      await this.prisma.userDevice.updateMany({
        where: { id: { in: toRevoke.map((d) => d.id) } },
        data: { revokedAt: new Date() },
      });
    }
    return row.id;
  }

  // List the signed-in devices for a user (most recent first).
  async listDevices(userId: string, currentDeviceRowId?: string) {
    const rows = await this.prisma.userDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
    });
    return rows.map((d) => ({
      id: d.id,
      label: d.label || d.platform || "Unknown device",
      platform: d.platform,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
      current: !!currentDeviceRowId && d.id === currentDeviceRowId,
    }));
  }

  // Sign out one device remotely. Its next request is rejected by the guard.
  async revokeDevice(userId: string, deviceRowId: string) {
    const row = await this.prisma.userDevice.findFirst({
      where: { id: deviceRowId, userId },
    });
    if (!row) throw new BadRequestException("Device not found");
    await this.prisma.userDevice.update({
      where: { id: deviceRowId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private publicUser(u: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId?: string | null;
    scopes?: string[];
    phone?: string | null;
    avatarUrl?: string | null;
    tenantRoles?: Array<{ tenantId: string; role: Role }>;
  }) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: u.tenantId ?? null,
      scopes: u.scopes ?? [],
      phone: u.phone ?? null,
      avatarUrl: u.avatarUrl ?? null,
      tenantRoles: u.tenantRoles ?? [],
    };
  }

  private async withTenantRoles(user: any) {
    const tenantRoles = await (this.prisma as any).userTenantRole.findMany({
      where: { userId: user.id },
      select: { tenantId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return { ...user, tenantRoles };
  }

  async register(
    dto: RegisterDto,
    device?: { deviceId?: string; label?: string; platform?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException("Email already registered");

    // Public sign-up is always a CLIENT. Consultants/admins are created by admin.
    const role = Role.CLIENT;
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hash,
        role,
      },
    });
    await this.logActivity(user.id, "REGISTER");
    this.ghl.onUserRegistered({
      email: user.email,
      name: user.name,
      phone: user.phone,
    });
    if (dto.ref) {
      await this.attribution.attachSignupReferral(user.id, dto.ref);
    }
    const did = await this.registerDevice(user.id, device);
    return {
      token: this.sign(user, did),
      user: this.publicUser(await this.withTenantRoles(user)),
    };
  }

  async login(
    dto: LoginDto,
    device?: { deviceId?: string; label?: string; platform?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.isActive)
      throw new UnauthorizedException("Account is deactivated");
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    await this.logActivity(user.id, "LOGIN");
    const did = await this.registerDevice(user.id, device);
    return {
      token: this.sign(user, did),
      user: this.publicUser(await this.withTenantRoles(user)),
    };
  }

  // --- OTP (login / verification) ---
  async requestOtp(email: string, purpose: OtpPurpose = OtpPurpose.LOGIN) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Do not reveal whether the email exists.
    if (!user) return { sent: true };
    const code = this.genCode();
    await this.prisma.otpCode.create({
      data: {
        email,
        code,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await this.mail.send(
      email,
      "Your verification code",
      `Your one-time code is ${code}. It expires in 10 minutes.`,
    );
    return { sent: true };
  }

  async verifyOtp(
    email: string,
    code: string,
    device?: { deviceId?: string; label?: string; platform?: string },
  ) {
    const otp = await this.consumeOtp(email, code, OtpPurpose.LOGIN);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid code");
    void otp;
    await this.logActivity(user.id, "LOGIN_OTP");
    const did = await this.registerDevice(user.id, device);
    return {
      token: this.sign(user, did),
      user: this.publicUser(await this.withTenantRoles(user)),
    };
  }

  // --- Password reset ---
  async forgotPassword(email: string) {
    return this.requestOtp(email, OtpPurpose.RESET);
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.consumeOtp(dto.email, dto.code, OtpPurpose.RESET);
    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { password: hash },
    });
    return { reset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) throw new BadRequestException("Current password is incorrect");
    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    return { changed: true };
  }

  async deleteAccount(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const anonymizedEmail = `deleted+${user.id}.${Date.now()}@redacted.local`;
    const replacementPassword = await bcrypt.hash(
      randomBytes(32).toString("hex"),
      10,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        password: replacementPassword,
        name: "Deleted User",
        phone: null,
        avatarUrl: null,
        bio: null,
        expertise: null,
        title: null,
        pushToken: null,
        isActive: false,
      },
    });
    await this.prisma.userDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.logActivity(userId, "ACCOUNT_DELETED");
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(await this.withTenantRoles(user));
  }

  private async consumeOtp(email: string, code: string, purpose: OtpPurpose) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, code, purpose, used: false },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.expiresAt < new Date())
      throw new BadRequestException("Invalid or expired code");
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });
    return otp;
  }

  private genCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async logActivity(userId: string, action: string) {
    try {
      await this.prisma.activityLog.create({ data: { userId, action } });
    } catch {
      // non-fatal
    }
  }
}
