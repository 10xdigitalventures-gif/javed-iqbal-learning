import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Role, Tenant } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import { ReconciliationService } from "./reconciliation.service";
import { ExternalRevenueDto, CloseMonthDto } from "./dto";

// Admin-only revenue reconciliation surface.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private recon: ReconciliationService) {}

  // Explicit ?tenantId= wins; otherwise fall back to the request's tenant
  // context (a tenant subdomain), else platform-wide (null).
  private resolveTenant(tenant?: Tenant, override?: string) {
    return override || tenant?.id || null;
  }

  @Get()
  reconcile(
    @Query("period") period?: string,
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() tenant?: Tenant,
  ) {
    return this.recon.reconcile(period, this.resolveTenant(tenant, tenantId));
  }

  @Get("export")
  async export(
    @Res() res: Response,
    @Query("period") period?: string,
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() tenant?: Tenant,
  ) {
    const csv = await this.recon.reconcileCsv(
      period,
      this.resolveTenant(tenant, tenantId),
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reconciliation.csv"',
    );
    res.send(csv);
  }

  @Get("external")
  listExternal(
    @Query("period") period?: string,
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() tenant?: Tenant,
  ) {
    return this.recon.listExternal(
      period,
      this.resolveTenant(tenant, tenantId),
    );
  }

  @Post("external")
  addExternal(@Body() dto: ExternalRevenueDto, @CurrentUser() user: AuthUser) {
    return this.recon.addExternal(dto, user.userId);
  }

  @Delete("external/:id")
  deleteExternal(@Param("id") id: string) {
    return this.recon.deleteExternal(id);
  }

  @Post("close")
  close(
    @Body() dto: CloseMonthDto,
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() tenant?: Tenant,
  ) {
    return this.recon.close(
      dto.period,
      this.resolveTenant(tenant, tenantId),
      user.userId,
    );
  }

  @Get("closes")
  listCloses(
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() tenant?: Tenant,
  ) {
    return this.recon.listCloses(this.resolveTenant(tenant, tenantId));
  }
}
