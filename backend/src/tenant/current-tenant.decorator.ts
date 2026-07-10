import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Tenant } from "@prisma/client";

// Injects the tenant resolved by TenantContextMiddleware. In practice this is
// never undefined for HTTP requests because the middleware falls back to the
// default tenant, but consumers should still handle undefined defensively.
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | undefined => {
    const req = ctx.switchToHttp().getRequest<{ tenant?: Tenant }>();
    return req.tenant;
  },
);
