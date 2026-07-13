import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import * as express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

const logger = new Logger("Bootstrap");

function assertCriticalEnv() {
  if (process.env.NODE_ENV !== "production") return;
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "PUBLIC_API_URL",
    "PUBLIC_WEB_URL",
  ];
  const missing = required.filter((key) => !(process.env[key] || "").trim());
  if (missing.length) {
    throw new Error(
      `Missing critical environment variables: ${missing.join(", ")}`,
    );
  }
}

// Build a CORS origin checker. In production we allow:
//  - PUBLIC_WEB_URL (the primary web app)
//  - any origin in CORS_ALLOWED_ORIGINS (comma-separated; e.g. tenant custom
//    domains + the marketplace app)
//  - any subdomain of PLATFORM_ROOT_DOMAIN (tenant storefronts)
type CorsCb = (err: Error | null, allow?: boolean) => void;
function buildCorsOrigin() {
  const rootDomain = (process.env.PLATFORM_ROOT_DOMAIN || "")
    .trim()
    .toLowerCase();
  const explicit = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const webOrigin = process.env.PUBLIC_WEB_URL;
  if (webOrigin) explicit.push(webOrigin);
  const allow = new Set(
    explicit.map((o) => o.replace(/\/$/, "").toLowerCase()),
  );
  return (origin: string | undefined, cb: CorsCb) => {
    // Same-origin / non-browser requests send no Origin header.
    if (!origin) return cb(null, true);
    const normalized = origin.replace(/\/$/, "").toLowerCase();
    if (allow.has(normalized)) return cb(null, true);
    if (rootDomain) {
      try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host === rootDomain || host.endsWith("." + rootDomain)) {
          return cb(null, true);
        }
      } catch {
        // malformed origin -> deny below
      }
    }
    return cb(new Error("Not allowed by CORS"), false);
  };
}

async function bootstrap() {
  assertCriticalEnv();
  // rawBody: true exposes req.rawBody so we can verify webhook HMAC signatures
  // (e.g. Whop) over the exact bytes that were signed.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: { action: "deny" },
      noSniff: true,
      hsts:
        process.env.NODE_ENV === "production"
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
        },
      },
    }),
  );

  // In production, restrict CORS to known origins: the primary web app, any
  // subdomain of the platform root domain (tenant storefronts + marketplace),
  // and any explicitly allowlisted origin (e.g. tenant custom domains).
  app.enableCors({
    origin: process.env.NODE_ENV === "production" ? buildCorsOrigin() : true,
    credentials: true,
  });
  // Capture the raw body alongside parsed JSON/urlencoded bodies so webhook
  // signature verification has access to the original payload bytes.
  const rawBodySaver = (
    req: express.Request & { rawBody?: Buffer },
    _res: express.Response,
    buf: Buffer,
  ) => {
    if (buf && buf.length) req.rawBody = buf;
  };
  app.use(express.json({ verify: rawBodySaver }));
  app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // NOTE: Uploaded media is NOT served via a public static route. Access is
  // controlled through signed, expiring URLs: the local driver delivers files
  // via GET /api/media/file/:key (HMAC signature + expiry verified in
  // MediaController), and the S3 driver uses presigned GET URLs. This prevents
  // unauthenticated enumeration of private client–consultant media.

  await app.listen(process.env.PORT || 4000);
  logger.log(`API running on port ${process.env.PORT || 4000}`);
}
bootstrap();
