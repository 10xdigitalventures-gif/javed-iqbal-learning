import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { PayoutStatus, Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { PayoutsService } from "./payouts.service";

@Controller("payouts")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(
    private service: PayoutsService,
    private prisma: PrismaService,
  ) {}

  // Main admin: per-consultant/tenant revenue breakdown (Phase 5).
  @Get("summary")
  @Roles(Role.ADMIN)
  summary() {
    return this.service.summaryByTenant();
  }

  // Main admin: raw payout rows, optionally filtered.
  @Get()
  @Roles(Role.ADMIN)
  list(
    @Query("tenantId") tenantId?: string,
    @Query("status") status?: PayoutStatus,
  ) {
    return this.service.list({ tenantId, status });
  }

  // Dedicated admin (tenant-scoped): the acting user's own tenant earnings.
  // Also visible to a consultant on their own panel breakdown.
  @Get("me")
  @Roles(Role.TENANT_ADMIN, Role.CONSULTANT, Role.ADMIN)
  async me(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { tenantId: true },
    });
    if (!me?.tenantId) {
      throw new ForbiddenException("No tenant associated with this account");
    }
    return this.service.tenantSummary(me.tenantId);
  }
}
