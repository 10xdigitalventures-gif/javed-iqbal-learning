import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private service: OrdersService) {}

  // Any authenticated user can buy a book / bundle / subscription. Returns the
  // order plus a PENDING payment to drive the existing checkout flow.
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
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

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }
}
