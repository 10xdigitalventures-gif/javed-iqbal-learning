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
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  private sign(user: { id: string; email: string; role: Role }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private publicUser(u: {
    id: string;
    email: string;
    name: string;
    role: Role;
    phone?: string | null;
    avatarUrl?: string | null;
  }) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      phone: u.phone ?? null,
      avatarUrl: u.avatarUrl ?? null,
    };
  }

  async register(dto: RegisterDto) {
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
    return { token: this.sign(user), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.isActive)
      throw new UnauthorizedException("Account is deactivated");
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    await this.logActivity(user.id, "LOGIN");
    return { token: this.sign(user), user: this.publicUser(user) };
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

  async verifyOtp(email: string, code: string) {
    const otp = await this.consumeOtp(email, code, OtpPurpose.LOGIN);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid code");
    void otp;
    await this.logActivity(user.id, "LOGIN_OTP");
    return { token: this.sign(user), user: this.publicUser(user) };
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  private async consumeOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ) {
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
