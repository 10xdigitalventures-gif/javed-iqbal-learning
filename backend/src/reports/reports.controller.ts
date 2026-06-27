import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@prisma/client";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get("admin/overview")
  @Roles(Role.ADMIN)
  overview() {
    return this.service.adminOverview();
  }

  // CSV export of the platform activity log for audits/compliance.
  @Get("admin/audit")
  @Roles(Role.ADMIN)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=audit-log.csv")
  async audit(@Res() res: Response) {
    const csv = await this.service.auditCsv();
    res.send(csv);
  }

  // Daily time-series (revenue, orders, signups, enrollments, completions).
  @Get("admin/timeseries")
  @Roles(Role.ADMIN)
  timeseries(@Query("from") from?: string, @Query("to") to?: string) {
    return this.service.timeseries(from, to);
  }

  @Get("admin/timeseries/export")
  @Roles(Role.ADMIN)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=timeseries.csv")
  async timeseriesExport(
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    res.send(await this.service.timeseriesCsv(from, to));
  }

  // Per-course completion / drop-off funnel.
  @Get("admin/funnel")
  @Roles(Role.ADMIN)
  funnel(@Query("from") from?: string, @Query("to") to?: string) {
    return this.service.courseFunnel(from, to);
  }

  @Get("admin/funnel/export")
  @Roles(Role.ADMIN)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=course-funnel.csv")
  async funnelExport(
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    res.send(await this.service.courseFunnelCsv(from, to));
  }

  @Get("consultant/me")
  @Roles(Role.CONSULTANT)
  myConsultantStats(@CurrentUser() user: AuthUser) {
    return this.service.consultantStats(user.userId);
  }

  @Get("consultant/:id")
  @Roles(Role.ADMIN)
  consultantStats(@Param("id") id: string) {
    return this.service.consultantStats(id);
  }

  @Get("client/me")
  @Roles(Role.CLIENT)
  myClientStats(@CurrentUser() user: AuthUser) {
    return this.service.clientStats(user.userId);
  }
}
