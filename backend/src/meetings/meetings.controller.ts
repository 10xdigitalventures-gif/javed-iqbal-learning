import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { MeetingsService } from "./meetings.service";
import {
  BookMeetingDto,
  RescheduleDto,
  SetAvailabilityDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("meetings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private service: MeetingsService) {}

  @Get("availability/:consultantId")
  getAvailability(@Param("consultantId") consultantId: string) {
    return this.service.getAvailability(consultantId);
  }

  @Post("availability")
  @Roles(Role.CONSULTANT)
  setAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.service.setAvailability(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("upcoming") upcoming?: string) {
    return this.service.list(user, upcoming === "true");
  }

  @Post()
  @Roles(Role.CLIENT)
  book(@CurrentUser() user: AuthUser, @Body() dto: BookMeetingDto) {
    return this.service.book(user.userId, dto);
  }

  @Post(":id/approve")
  approve(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { meetingUrl?: string },
  ) {
    return this.service.approve(user, id, body?.meetingUrl);
  }

  @Post(":id/reject")
  reject(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.reject(user, id);
  }

  @Post(":id/reschedule")
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.service.reschedule(user, id, dto);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.cancel(user, id);
  }

  @Post(":id/complete")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.complete(user, id);
  }
}
