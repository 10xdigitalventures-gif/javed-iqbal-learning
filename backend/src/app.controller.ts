import { Controller, Get } from "@nestjs/common";

/**
 * Public root controller. Provides lightweight, unauthenticated endpoints so
 * that hitting the API root (or a load-balancer health probe) returns a useful
 * JSON response instead of a 404. All real functionality lives in the feature
 * modules (auth, courses, books, library, etc.).
 */
@Controller()
export class AppController {
  private readonly startedAt = Date.now();

  // GET /api  -> friendly service banner
  @Get()
  root() {
    const name = (process.env.PLATFORM_NAME || "10X Platform") + " API";
    return {
      name,
      status: "ok",
      message: "API is running. See /api/health for status.",
      docsHint:
        "Endpoints are namespaced, e.g. /api/auth/login, /api/courses, /api/books, /api/library.",
    };
  }

  // GET /api/health -> machine-readable health probe
  @Get("health")
  health() {
    return {
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
