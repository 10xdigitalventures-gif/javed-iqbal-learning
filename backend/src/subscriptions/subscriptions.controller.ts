import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { SubscriptionsService } from "./subscriptions.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("subscriptions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  // ---- Plans ----
  @Get("plans")
  listPlans() {
    return this.service.listActivePlans();
  }

  @Get("plans/all")
  @Roles(Role.ADMIN)
  listAllPlans() {
    return this.service.listAllPlans();
  }

  @Post("plans")
  @Roles(Role.ADMIN)
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Patch("plans/:id")
  @Roles(Role.ADMIN)
  updatePlan(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(id, dto);
  }

  @Delete("plans/:id")
  @Roles(Role.ADMIN)
  deletePlan(@Param("id") id: string) {
    return this.service.deletePlan(id);
  }

  // ---- My subscription ----
  @Get("me")
  mySubscription(@CurrentUser() user: AuthUser) {
    return this.service.mySubscription(user.userId);
  }

  @Get("me/history")
  myHistory(@CurrentUser() user: AuthUser) {
    return this.service.myHistory(user.userId);
  }

  @Patch("me/:id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.cancel(user.userId, id);
  }
}
