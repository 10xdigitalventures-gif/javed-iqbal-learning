import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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

  // Paginated / searchable / sortable list for the admin orders table.
  @Get("all/paged")
  @Roles(Role.ADMIN)
  allPaged(
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("kind") kind?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.service.listAllPaged({
      q,
      status,
      kind,
      page,
      pageSize,
      sort,
      order,
    });
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getForUser(user, id);
  }
}
