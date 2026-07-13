import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser, AuthUser } from "./current-user.decorator";
import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from "./dto";
import { enforceAuthRateLimit } from "./auth-rate-limit";

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function authKey(req: Request, email?: string) {
  return `${clientIp(req)}:${(email || "").trim().toLowerCase()}`;
}

function writeAuthCookie(res: Response, token: string) {
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.AUTH_COOKIE_DOMAIN
      ? { domain: process.env.AUTH_COOKIE_DOMAIN }
      : {}),
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(process.env.AUTH_COOKIE_DOMAIN
      ? { domain: process.env.AUTH_COOKIE_DOMAIN }
      : {}),
  });
}

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ) {
    enforceAuthRateLimit(
      "auth:register",
      authKey(req, dto.email),
      Number(process.env.AUTH_REGISTER_LIMIT || 5),
      Number(process.env.AUTH_REGISTER_WINDOW_SEC || 600),
    );
    const result = this.auth.register(dto, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
    return Promise.resolve(result).then((payload) => {
      writeAuthCookie(res, payload.token);
      return payload;
    });
  }

  @Post("login")
  login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    enforceAuthRateLimit(
      "auth:login",
      authKey(req, dto.email),
      Number(process.env.AUTH_LOGIN_LIMIT || 5),
      Number(process.env.AUTH_LOGIN_WINDOW_SEC || 60),
    );
    const result = this.auth.login(dto, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
    return Promise.resolve(result).then((payload) => {
      writeAuthCookie(res, payload.token);
      return payload;
    });
  }

  @Post("otp/request")
  requestOtp(@Req() req: Request, @Body() dto: RequestOtpDto) {
    enforceAuthRateLimit(
      "auth:otp:request",
      authKey(req, dto.email),
      Number(process.env.AUTH_OTP_REQUEST_LIMIT || 5),
      Number(process.env.AUTH_OTP_REQUEST_WINDOW_SEC || 600),
    );
    return this.auth.requestOtp(dto.email);
  }

  @Post("otp/verify")
  verifyOtp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: VerifyOtpDto,
  ) {
    enforceAuthRateLimit(
      "auth:otp:verify",
      authKey(req, dto.email),
      Number(process.env.AUTH_OTP_VERIFY_LIMIT || 10),
      Number(process.env.AUTH_OTP_VERIFY_WINDOW_SEC || 600),
    );
    const result = this.auth.verifyOtp(dto.email, dto.code, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
    return Promise.resolve(result).then((payload) => {
      writeAuthCookie(res, payload.token);
      return payload;
    });
  }

  @Post("forgot-password")
  forgot(@Req() req: Request, @Body() dto: ForgotPasswordDto) {
    enforceAuthRateLimit(
      "auth:forgot",
      authKey(req, dto.email),
      Number(process.env.AUTH_FORGOT_LIMIT || 5),
      Number(process.env.AUTH_FORGOT_WINDOW_SEC || 600),
    );
    return this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  reset(@Req() req: Request, @Body() dto: ResetPasswordDto) {
    enforceAuthRateLimit(
      "auth:reset",
      authKey(req, dto.email),
      Number(process.env.AUTH_RESET_LIMIT || 5),
      Number(process.env.AUTH_RESET_WINDOW_SEC || 600),
    );
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("delete-account")
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: DeleteAccountDto,
  ) {
    clearAuthCookie(res);
    return this.auth.deleteAccount(user.userId, dto.currentPassword);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  // ---- Concurrent device management ----
  @UseGuards(JwtAuthGuard)
  @Get("devices")
  devices(@CurrentUser() user: AuthUser) {
    return this.auth.listDevices(user.userId, (user as any).deviceRowId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("devices/:id/revoke")
  revokeDevice(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.auth.revokeDevice(user.userId, id);
  }
}
