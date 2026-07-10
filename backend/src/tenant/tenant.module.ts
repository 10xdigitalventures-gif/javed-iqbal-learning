import { Global, Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantController } from "./tenant.controller";
import { TenantContextMiddleware } from "./tenant-context.middleware";

// Global so the tenant context (service + middleware) is available anywhere,
// including the AppModule middleware configuration, without re-importing.
@Global()
@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantContextMiddleware],
  exports: [TenantService, TenantContextMiddleware],
})
export class TenantModule {}
