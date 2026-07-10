import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "@prisma/client";
import { GhlSyncService } from "./ghl-sync.service";

// Admin surface for the GHL outbound sync engine. All routes are admin-only.
@Controller("ghl-sync")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GhlSyncController {
  constructor(private readonly ghl: GhlSyncService) {}

  @Get("status")
  status() {
    return this.ghl.status();
  }

  @Post("test")
  test(@Body() body: { email: string; name?: string }) {
    return this.ghl.sendTest(body?.email, body?.name);
  }

  // Trigger the inactive-contact sweep. Meant to be hit by a daily cron.
  @Post("run-inactive")
  runInactive(@Query("days") days?: string) {
    const n = days ? Number(days) : undefined;
    return this.ghl.runInactiveSync(
      Number.isFinite(n as number) ? n : undefined,
    );
  }
}
