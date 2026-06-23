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
import { UsersService } from "./users.service";
import { CreateUserDto, PushTokenDto, UpdateUserDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  // Public-ish (any authed user) browse of active consultants.
  @Get("consultants")
  consultants() {
    return this.service.listConsultants();
  }

  // Register (or clear) the current user's Expo push token (any role).
  @Post("me/push-token")
  setPushToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.service.setPushToken(user.userId, dto.token);
  }

  // A consultant's own assigned clients.
  @Get("my-clients")
  @Roles(Role.CONSULTANT)
  myClients(@CurrentUser() user: AuthUser) {
    return this.service.assignedClients(user.userId);
  }

  @Get()
  @Roles(Role.ADMIN)
  list(@Query("role") role?: Role) {
    return this.service.list(role);
  }

  @Get(":id")
  @Roles(Role.ADMIN)
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/activate")
  @Roles(Role.ADMIN)
  activate(@Param("id") id: string) {
    return this.service.setActive(id, true);
  }

  @Patch(":id/deactivate")
  @Roles(Role.ADMIN)
  deactivate(@Param("id") id: string) {
    return this.service.setActive(id, false);
  }
}
