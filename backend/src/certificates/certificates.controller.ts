import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { CertificatesService } from "./certificates.service";

@Controller("certificates")
export class CertificatesController {
  constructor(private service: CertificatesService) {}

  // PUBLIC — no auth guard. Anyone can verify a certificate by serial.
  @Get("verify/:serial")
  verify(@Param("serial") serial: string) {
    return this.service.verify(serial);
  }

  // Authenticated routes below.
  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.service.myCertificates(user.userId);
  }

  @Post("issue/:courseId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT)
  issue(@CurrentUser() user: AuthUser, @Param("courseId") courseId: string) {
    return this.service.issueForUser(user.userId, courseId);
  }

  // Keep the param route last so it does not shadow the static routes above.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getForOwner(id, user.userId);
  }
}
