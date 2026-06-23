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
import { PackageType, Role } from "@prisma/client";
import { PackagesService } from "./packages.service";
import { CreatePackageDto, UpdatePackageDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("packages")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagesController {
  constructor(private service: PackagesService) {}

  // Any authed user can view the active catalog.
  @Get()
  list(@Query("type") type?: PackageType) {
    return this.service.listActive(type);
  }

  @Get("all")
  @Roles(Role.ADMIN)
  listAll() {
    return this.service.listAll();
  }

  // Active plans offered by a specific consultant (assigned + global plans).
  @Get("consultant/:consultantId")
  listForConsultant(@Param("consultantId") consultantId: string) {
    return this.service.listForConsultant(consultantId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePackageDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdatePackageDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
