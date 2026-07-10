import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

// Attach Cache-Control headers to successful GET responses on public endpoints
// so that edge CDNs (Vercel, Cloudflare) can cache them aggressively while
// browsers get a shorter window.
@Injectable()
export class CacheHeadersInterceptor implements NestInterceptor {
  constructor(
    private readonly maxAge = 60, // browser cache in seconds
    private readonly sMaxAge = 300, // CDN / shared-cache in seconds
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (!res.headersSent) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=" + this.maxAge + ", s-maxage=" + this.sMaxAge,
          );
        }
      }),
    );
  }
}
