import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { SubscriptionsService } from "./subscriptions.service";
import { ChangePlanDto, CreatePlanDto, UpdatePlanDto } from "./dto";
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
  listPlans(@Query("currency") currency?: string) {
    return this.service.listActivePlans(currency);
  }

  // Supported display currencies + active conversion rates.
  @Get("currencies")
  currencies() {
    return this.service.currencies();
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

  // Prorated quote for switching to another plan (read-only).
  @Get("me/change/:planId/quote")
  quoteChange(
    @CurrentUser() user: AuthUser,
    @Param("planId") planId: string,
    @Query("currency") currency?: string,
  ) {
    return this.service.quoteChange(user.userId, planId, currency);
  }

  // Begin a (possibly prorated) plan change — returns an order to pay.
  @Post("me/change/:planId")
  changePlan(
    @CurrentUser() user: AuthUser,
    @Param("planId") planId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.service.changePlan(user.userId, planId, dto?.currency);
  }

  // Begin a manual renewal of the active subscription.
  @Post("me/renew")
  renew(@CurrentUser() user: AuthUser) {
    return this.service.renewNow(user.userId);
  }

  @Patch("me/:id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.cancel(user.userId, id);
  }

  // ---- Dunning (admin / cron) ----
  // Trigger the renewal-reminder + grace + expiry sweep. Intended to be called
  // by a daily scheduled job.
  @Post("admin/dunning/run")
  @Roles(Role.ADMIN)
  runDunning() {
    return this.service.processDunning();
  }
}
