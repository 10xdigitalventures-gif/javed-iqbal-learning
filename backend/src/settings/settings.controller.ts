import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("settings")
export class SettingsController {
  constructor(private service: SettingsService) {}

  // Public read so the web/mobile apps can theme themselves.
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Body() values: Record<string, string>) {
    return this.service.update(values);
  }

  // Admin-only: payment + storage environment configuration schema & values.
  @Get("env")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getEnv() {
    return this.service.getEnv();
  }

  @Put("env")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateEnv(@Body() values: Record<string, string>) {
    return this.service.updateEnv(values);
  }
}
