import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
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

  @Post(":id/read")
  read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post("read-all")
  readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.userId);
  }
}
