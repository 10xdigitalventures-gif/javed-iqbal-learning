import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { Role, Tenant } from "@prisma/client";
import { TenantService } from "./tenant.service";
import { CacheHeadersInterceptor } from "../common/cache-headers.interceptor";
import { CreateTenantDto, OnboardTenantDto, UpdateTenantDto } from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("tenant")
export class TenantController {
  constructor(private service: TenantService) {}

  // Public: marketplace directory of all listed experts/tenants. The
  // separate 10X marketplace frontend renders these as expert cards.
  @SkipThrottle()
  @Get("directory")
  @UseInterceptors(new CacheHeadersInterceptor())
  directory(@Query("category") category?: string) {
    return this.service.directory(category);
  }

  // Public: check subdomain availability for the onboarding form.
  @Get("slug-available")
  slugAvailable(@Query("slug") slug: string) {
    return this.service.isSlugAvailable(slug || "");
  }

  // Public: self-serve onboarding from the marketplace. Provisions a new
  // tenant on its platform subdomain (unlisted until an admin approves it).
  @Post("onboard")
  onboard(@Body() dto: OnboardTenantDto) {
    return this.service.onboard(dto);
  }

  // Public: current tenant branding, resolved from host/header by the
  // TenantContextMiddleware. Web + mobile call this on boot to theme.
  @Get("current")
  async current(@Req() req: Request & { tenant?: Tenant | null }) {
    const tenant = req.tenant ?? (await this.service.getDefault());
    return this.service.publicView(tenant);
  }

  // Public: a single expert storefront view for the marketplace detail
  // page (resolved by slug).
  // Public: DNS setup check + instructions for custom-domain white-labelling.
  // Must be declared before @Get("public/:slug") to avoid slug-param capture.
  @Get("public/verify-domain")
  @SkipThrottle()
  @UseInterceptors(new CacheHeadersInterceptor(10, 30))
  verifyDomain(@Query("domain") domain: string) {
    return this.service.verifyDomain(domain);
  }

  @SkipThrottle()
  @Get("public/:slug")
  @UseInterceptors(new CacheHeadersInterceptor())
  publicBySlug(@Param("slug") slug: string) {
    return this.service.publicBySlug(slug);
  }

  // Public: a single expert storefront catalog (published courses +
  // active packages) for the marketplace detail page.
  @SkipThrottle()
  @Get("public/:slug/catalog")
  @UseInterceptors(new CacheHeadersInterceptor())
  publicCatalog(@Param("slug") slug: string) {
    return this.service.publicCatalog(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  list() {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(id, dto);
  }
}
