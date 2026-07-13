import { Global, Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantController } from "./tenant.controller";
import { TenantAdminController } from "./tenant-admin.controller";
import { CoursesModule } from "../courses/courses.module";
import { PackagesModule } from "../packages/packages.module";
import { BooksModule } from "../books/books.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TenantContextMiddleware } from "./tenant-context.middleware";

// Global so the tenant context (service + middleware) is available anywhere,
// including the AppModule middleware configuration, without re-importing.
@Global()
@Module({
  imports: [PrismaModule, CoursesModule, PackagesModule, BooksModule],
  controllers: [TenantController, TenantAdminController],
  providers: [TenantService, TenantContextMiddleware],
  exports: [TenantService, TenantContextMiddleware],
})
export class TenantModule {}
