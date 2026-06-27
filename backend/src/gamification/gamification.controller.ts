import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { GamificationService } from "./gamification.service";
import { CheckInDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("gamification")
@UseGuards(JwtAuthGuard, RolesGuard)
export class GamificationController {
  constructor(private service: GamificationService) {}

  // Points, streak and badge status for the signed-in learner.
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.service.getProfile(user.userId);
  }

  // Daily check-in: extends or resets the learning streak. Call once on app
  // open; passing the device's local day keeps streaks correct across timezones.
  @Post("checkin")
  checkin(@CurrentUser() user: AuthUser, @Body() dto: CheckInDto) {
    return this.service.checkIn(user.userId, dto.day);
  }

  // Top learners by points (with the caller's own rank).
  @Get("leaderboard")
  leaderboard(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.service.leaderboard(user.userId, limit ? Number(limit) : 20);
  }
}
