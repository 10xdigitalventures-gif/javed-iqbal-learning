import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import * as express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: true exposes req.rawBody so we can verify webhook HMAC signatures
  // (e.g. Whop) over the exact bytes that were signed.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // In production, restrict CORS to the known web origin.
  const webOrigin = process.env.PUBLIC_WEB_URL;
  app.enableCors({
    origin:
      process.env.NODE_ENV === "production" && webOrigin ? webOrigin : true,
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
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${process.env.PORT || 4000}/api`);
}
bootstrap();
