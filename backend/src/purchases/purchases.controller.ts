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
import { Role } from "@prisma/client";
import { PurchasesService } from "./purchases.service";
import { UsageService } from "./usage.service";
import { CreatePurchaseDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("purchases")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(
    private service: PurchasesService,
    private usage: UsageService,
  ) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("mine")
  @Roles(Role.CLIENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.service.listForClient(user.userId);
  }

  // Remaining per-channel allowance for the current client with a consultant.
  // Used by the chat composer to enable/disable Text/Audio/Video.
  @Get("allowance")
  @Roles(Role.CLIENT)
  allowance(
    @CurrentUser() user: AuthUser,
    @Query("consultantId") consultantId: string,
  ) {
    return this.usage.remainingAllowance(user.userId, consultantId);
  }

  @Get("consultant")
  @Roles(Role.CONSULTANT)
  forConsultant(@CurrentUser() user: AuthUser) {
    return this.service.listForConsultant(user.userId);
  }

  @Get("all")
  @Roles(Role.ADMIN)
  all() {
    return this.service.listAll();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.service.cancel(id);
  }
}
