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
import { SupportService } from "./support.service";
import {
  AssignTicketDto,
  CreateTicketDto,
  ReplyTicketDto,
  UpdateTicketStatusDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("support")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private service: SupportService) {}

  // ----- ticket owner (client / consultant) -----
  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.service.create(user.userId, dto);
  }

  // ----- admin-portal staff (ADMIN + SUPPORT) -----
  @Get("admin/all")
  @Roles(Role.ADMIN, Role.SUPPORT)
  listAll(@Query("status") status?: string) {
    return this.service.listAll(status);
  }

  // Staff who can be assigned a ticket (ADMIN + SUPPORT users).
  @Get("admin/agents")
  @Roles(Role.ADMIN, Role.SUPPORT)
  agents() {
    return this.service.listStaff();
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.get(user, id);
  }

  @Post(":id/reply")
  reply(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.service.reply(user, id, dto);
  }

  @Patch(":id/status")
  @Roles(Role.ADMIN, Role.SUPPORT)
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.setStatus(user, id, dto);
  }

  @Post(":id/assign")
  @Roles(Role.ADMIN, Role.SUPPORT)
  assign(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.service.assign(user, id, dto.assigneeId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.SUPPORT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user, id);
  }
}
