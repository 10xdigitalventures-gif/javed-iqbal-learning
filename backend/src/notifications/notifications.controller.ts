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
import { UpdatePreferenceDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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

  @Post(":id/read")
  read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post("read-all")
  readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.userId);
  }
}
