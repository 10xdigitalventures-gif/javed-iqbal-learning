import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser, AuthUser } from "./current-user.decorator";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
  }

  @Post("otp/request")
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.email);
  }

  @Post("otp/verify")
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.email, dto.code, {
      deviceId: dto.deviceId,
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
  }

  @Post("forgot-password")
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.userId, dto);
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
  revokeDevice(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.auth.revokeDevice(user.userId, id);
  }
}
