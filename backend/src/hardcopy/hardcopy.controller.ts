import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { HardCopyService } from "./hardcopy.service";
import { CreateHardCopyOrderDto, UpdateHardCopyStatusDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("hardcopy-orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HardCopyController {
  constructor(private service: HardCopyService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHardCopyOrderDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.service.listForUser(user.userId);
  }

  @Get("all")
  @Roles(Role.ADMIN)
  all() {
    return this.service.listAll();
  }

  @Patch(":id/status")
  @Roles(Role.ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateHardCopyStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
