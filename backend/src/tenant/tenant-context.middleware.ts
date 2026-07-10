import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { Tenant } from "@prisma/client";
import { TenantService } from "./tenant.service";

// Attaches the resolved tenant to every request as `req.tenant`. It only reads
// context — it never filters or blocks a request — so wiring it globally is
// safe and does not change any existing endpoint behaviour. Per-tenant scoping
// is opted into by individual services reading req.tenant when they are ready.
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantService) {}

  async use(
    req: Request & { tenant?: Tenant | null },
    _res: Response,
    next: NextFunction,
  ) {
    try {
      const headerTenant =
        (req.headers["x-tenant-id"] as string | undefined) ||
        (req.headers["x-tenant"] as string | undefined);
      const host =
        (req.headers["x-forwarded-host"] as string | undefined) ||
        req.headers.host;
      req.tenant = await this.tenants.resolve({
        tenantId: headerTenant,
        host: host || undefined,
      });
    } catch {
      // Never block a request if tenant resolution fails.
      req.tenant = null;
    }
    next();
  }
}
