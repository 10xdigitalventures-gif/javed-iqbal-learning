import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { ActivityService } from "./activity.service";

function safeBody(body: any) {
  if (!body || typeof body !== "object") return body;
  const clone = { ...body };
  for (const key of Object.keys(clone)) {
    if (/password|token|secret|key|otp|authorization/i.test(key)) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || "GET").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const user = req.user || null;
    const tenant = req.tenant || null;
    const path = req.originalUrl || req.url || "";
    const action = `${method} ${path.split("?")[0]}`;
    const entity =
      path.split("?")[0].split("/").filter(Boolean).slice(1, 3).join("/") ||
      null;
    const entityId =
      req.params?.id || req.params?.idOrSlug || req.params?.slug || null;

    return next.handle().pipe(
      tap({
        next: (result) => {
          this.activity
            .logFull({
              userId: user?.userId ?? null,
              tenantId: tenant?.id ?? (result as any)?.tenantId ?? null,
              action,
              entity,
              entityId,
              before: undefined,
              after: result && typeof result === "object" ? result : undefined,
              meta: {
                method,
                path,
                params: req.params || {},
                query: req.query || {},
                body: safeBody(req.body),
                status: "success",
                durationMs: Date.now() - startedAt,
              },
              ip: req.ip,
              userAgent: req.headers?.["user-agent"] || null,
              requestId:
                req.headers?.["x-request-id"] ||
                req.headers?.["x-correlation-id"] ||
                null,
            })
            .catch(() => {});
        },
        error: (err) => {
          this.activity
            .logFull({
              userId: user?.userId ?? null,
              tenantId: tenant?.id ?? null,
              action,
              entity,
              entityId,
              meta: {
                method,
                path,
                params: req.params || {},
                query: req.query || {},
                body: safeBody(req.body),
                status: "error",
                error: err?.message || String(err),
                durationMs: Date.now() - startedAt,
              },
              ip: req.ip,
              userAgent: req.headers?.["user-agent"] || null,
              requestId:
                req.headers?.["x-request-id"] ||
                req.headers?.["x-correlation-id"] ||
                null,
            })
            .catch(() => {});
        },
      }),
    );
  }
}
