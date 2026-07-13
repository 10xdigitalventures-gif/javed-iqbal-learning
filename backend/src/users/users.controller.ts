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
import {
  CreateUserDto,
  PushTokenDto,
  UpdateUserDto,
  TenantRoleDto,
} from "./dto";
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

  // Paginated, searchable, sortable list for admin tables.
  @Get("paged")
  @Roles(Role.ADMIN)
  listPaged(
    @Query("role") role?: Role,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.service.listPaged({
      role,
      q,
      status,
      page,
      pageSize,
      sort,
      order,
    });
  }

  // Distinct segmentation tags in use (for the push-notification composer).
  @Get("tags")
  @Roles(Role.ADMIN)
  tags() {
    return this.service.listTags();
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

  @Get(":id/tenant-roles")
  @Roles(Role.ADMIN)
  tenantRoles(@Param("id") id: string) {
    return this.service.listTenantRoles(id);
  }

  @Post(":id/tenant-roles")
  @Roles(Role.ADMIN)
  assignTenantRole(@Param("id") id: string, @Body() dto: TenantRoleDto) {
    return this.service.assignTenantRole(id, dto.tenantId, dto.role);
  }

  @Post(":id/tenant-roles/remove")
  @Roles(Role.ADMIN)
  removeTenantRole(@Param("id") id: string, @Body() dto: TenantRoleDto) {
    return this.service.removeTenantRole(id, dto.tenantId, dto.role);
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
