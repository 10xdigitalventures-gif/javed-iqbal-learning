import {
  Body,
  Controller,
  Get,
  Header,
  Ip,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@prisma/client";
import { ActivityService } from "./activity.service";
import { ActivityEventDto, SyncActivityDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("activity")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private service: ActivityService) {}

  // Track a single action live.
  @Post()
  log(
    @CurrentUser() user: AuthUser,
    @Body() dto: ActivityEventDto,
    @Ip() ip: string,
  ) {
    return this.service.log(user.userId, dto, ip);
  }

  // Replay queued offline events when the device reconnects.
  @Post("sync")
  sync(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncActivityDto,
    @Ip() ip: string,
  ) {
    return this.service.syncBatch(user.userId, dto.events, ip);
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.service.recentForUser(user.userId);
  }

  // ---- Admin analytics ----
  @Get("analytics/overview")
  @Roles(Role.ADMIN)
  overview() {
    return this.service.overview();
  }

  @Get("analytics/reading")
  @Roles(Role.ADMIN)
  reading() {
    return this.service.readingAnalytics();
  }

  @Get("analytics/user/:id")
  @Roles(Role.ADMIN)
  userAnalytics(@Param("id") id: string) {
    return this.service.userAnalytics(id);
  }

  // ---- Global audit log (admin) ----

  // Paginated, filterable audit log across every user.
  @Get("admin/all")
  @Roles(Role.ADMIN)
  listAll(
    @Query("q") q?: string,
    @Query("action") action?: string,
    @Query("userId") userId?: string,
    @Query("tenantId") tenantId?: string,
    @Query("entity") entity?: string,
    @Query("entityId") entityId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.listAll({
      q,
      action,
      userId,
      tenantId,
      entity,
      entityId,
      from,
      to,
      page,
      pageSize,
    });
  }

  // Distinct action names for the filter dropdown.
  @Get("admin/actions")
  @Roles(Role.ADMIN)
  actions() {
    return this.service.distinctActions();
  }

  // CSV export of the (optionally filtered) global audit log.
  @Get("admin/export")
  @Roles(Role.ADMIN)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=audit-log.csv")
  async export(
    @Res() res: Response,
    @Query("q") q?: string,
    @Query("action") action?: string,
    @Query("userId") userId?: string,
    @Query("tenantId") tenantId?: string,
    @Query("entity") entity?: string,
    @Query("entityId") entityId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const csv = await this.service.exportCsv({
      q,
      action,
      userId,
      tenantId,
      entity,
      entityId,
      from,
      to,
    });
    res.send(csv);
  }

  // Paginated audit log for one contact (contact detail page).
  @Get("admin/user/:id/logs")
  @Roles(Role.ADMIN)
  userLogs(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.forUserPaged(id, page, pageSize);
  }
}
