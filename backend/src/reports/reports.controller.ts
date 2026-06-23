import { Controller, Get, Header, Param, Res, UseGuards } from "@nestjs/common";
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
