import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role, Tenant } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import { AttributionService } from "./attribution.service";
import { TrackDto, CommissionStatusDto } from "./dto";

@Controller("attribution")
export class AttributionController {
  constructor(private attribution: AttributionService) {}

  // Public: track a referral-link click (no auth).
  @Post("track")
  track(@Body() dto: TrackDto) {
    return this.attribution.trackClick(dto.code);
  }

  // Authenticated: my shareable referral code (created on first call).
  @UseGuards(JwtAuthGuard)
  @Get("my-code")
  myCode(@CurrentUser() user: AuthUser, @CurrentTenant() tenant?: Tenant) {
    return this.attribution.getOrCreateMyCode(user.userId, tenant?.id ?? null);
  }

  // Authenticated: my referral codes + earnings.
  @UseGuards(JwtAuthGuard)
  @Get("my-earnings")
  myEarnings(@CurrentUser() user: AuthUser) {
    return this.attribution.myEarnings(user.userId);
  }

  // Admin: commission ledger.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("commissions")
  commissions(
    @Query("status") status?: string,
    @Query("beneficiaryId") beneficiaryId?: string,
  ) {
    return this.attribution.listCommissions({ status, beneficiaryId });
  }

  // Admin: approve / mark paid / void a commission.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch("commissions/:id")
  setStatus(@Param("id") id: string, @Body() dto: CommissionStatusDto) {
    return this.attribution.setCommissionStatus(id, dto.status);
  }

  // Admin: attribution + commission summary for reporting.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("summary")
  summary(@CurrentTenant() tenant?: Tenant) {
    return this.attribution.summary(tenant?.id ?? null);
  }
}
