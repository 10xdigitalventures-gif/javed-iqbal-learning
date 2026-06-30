import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { UpdatePreferenceDto, BroadcastDto, ScheduleBroadcastDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "@prisma/client";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }

  @Get("unread-count")
  unread(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.userId);
  }

  // Per-user delivery preferences.
  @Get("preferences")
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.service.getPreference(user.userId);
  }

  @Patch("preferences")
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.service.updatePreference(user.userId, dto);
  }

  // Fire a test notification across the user's enabled channels.
  @Post("test")
  test(@CurrentUser() user: AuthUser) {
    return this.service.sendTest(user.userId);
  }

  // Admin: how many users a broadcast segment would reach.
  @Post("broadcast/preview")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  broadcastPreview(@Body() dto: BroadcastDto) {
    return this.service.previewBroadcast(dto);
  }

  // Admin: send a push + in-app notification to a segment of users.
  @Post("broadcast")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  broadcast(@Body() dto: BroadcastDto) {
    return this.service.broadcast(dto);
  }

  // Admin: queue a broadcast to send later or daily.
  @Post("schedule")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  schedule(@CurrentUser() user: AuthUser, @Body() dto: ScheduleBroadcastDto) {
    return this.service.scheduleBroadcast({ ...dto, createdById: user.userId });
  }

  // Admin: list queued / recurring scheduled broadcasts.
  @Get("scheduled")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  listScheduled() {
    return this.service.listScheduled();
  }

  // Admin: cancel a scheduled / recurring broadcast.
  @Post("scheduled/:id/cancel")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cancelScheduled(@Param("id") id: string) {
    return this.service.cancelScheduled(id);
  }

  @Post(":id/read")
  read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post("read-all")
  readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.userId);
  }
}
