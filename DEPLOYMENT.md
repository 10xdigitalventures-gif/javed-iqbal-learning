# Deployment & Production Hardening

This guide covers what to configure before running Consult Hub in production. It
complements `README.md` (local setup) and `ARCHITECTURE.md`.

## 1. Environment & secrets

Never ship the example secrets. Generate strong values and inject them through
your platform's secret manager (AWS Secrets Manager, Doppler, Vault, GitHub
Actions secrets, etc.). Required backend variables (see `backend/.env.example`):

- `JWT_SECRET` — long random string (e.g. `openssl rand -hex 32`).
- `DATABASE_URL` — managed Postgres with TLS.
- `MEDIA_SIGNING_SECRET` — random string for local signed media URLs.
- `PAYMENT_PROVIDERS` — comma-separated list of enabled gateways, e.g.
  `gopayfast,whop`. The first one is the default at checkout. `mock` is always
  available as a fallback for development.
- `GOPAYFAST_*` — GoPayFast (Apps/Net) IPG credentials and mode (below).
- `WHOP_*` — Whop API key, company id, and webhook signing secret (below).
- `SMTP_*` — transactional email provider.
- Storage and push variables (below).

### Payment gateways

Payments are abstracted behind a `PaymentProvider` interface
(`createCheckout` + `handleWebhook`). The bundled providers are `gopayfast`,
`whop`, and `mock`. The webhook/IPN — not the browser success redirect — is the
source of truth for activating a purchase.

```
PAYMENT_PROVIDERS=gopayfast,whop

# GoPayFast (Apps/Net Solutions IPG)
GOPAYFAST_MERCHANT_ID=
GOPAYFAST_SECURED_KEY=
GOPAYFAST_MODE=sandbox            # sandbox (UAT) or live
# GOPAYFAST_API_BASE=             # optional override of the IPG base URL
# GOPAYFAST_MERCHANT_NAME=        # optional, shown on hosted checkout

# Whop
WHOP_API_KEY=
WHOP_COMPANY_ID=
WHOP_WEBHOOK_SECRET=              # used to verify the x-whop-signature HMAC
# WHOP_API_BASE=                  # optional override of the Whop API base URL
```

Register the webhooks in each gateway's dashboard:

- GoPayFast IPN → `POST {PUBLIC_API_URL}/payments/webhook/gopayfast`
- Whop webhook → `POST {PUBLIC_API_URL}/payments/webhook/whop`
  (the raw request body is used for signature verification — `main.ts` enables
  `rawBody`).

Clients pick a gateway at checkout when more than one is enabled.

## 2. Database & migrations

```bash
cd backend
npm install
npm run prisma:generate
npx prisma migrate deploy   # apply committed migrations in prod
npm run prisma:seed         # optional: only for first-run demo data
npm run build
npm run start:prod
```

The migration `20260623000000_plans_consultants_channels_gateways` adds the
many-to-many link between `Package` and `User` (`_PackageConsultants`), the
`Package.channel` enum (`TEXT|AUDIO|VIDEO|COMBINED`), `Package.isGlobal`, and a
`pushToken` column on `User`. Run `prisma migrate deploy` (or `prisma db push`)
so the schema is current.

> Note: this migration intentionally wipes existing `Package`, `Purchase`, and
> `Payment` rows (old plans are replaced by fresh channel-aware plans). On an
> existing production database, take a backup first and re-seed plans afterward.
> The seed (`npm run prisma:seed`) recreates demo consultants plus four plans —
> text, audio, video, and a global combined plan — assigned to the demo
> consultants.

## 3. Object storage (audio/video)

The backend supports two storage drivers via `STORAGE_DRIVER`:

- `local` (default) — files on disk, served through `/api/media/file/:key` with
  HMAC-signed, expiring URLs. Fine for a single host; not for horizontal scale.
- `s3` — any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
  Reads are served through SigV4 presigned URLs. Set:

```
STORAGE_DRIVER=s3
S3_BUCKET=consult-hub-media
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=            # set for R2/MinIO, leave blank for AWS S3
MEDIA_URL_EXPIRES_SEC=604800
```

Uploaded media never gets a permanent public URL; clients refresh expired links
via `GET /api/media/sign?key=...`.

## 4. Real-time messaging

Messaging and notifications now push over Server-Sent Events at
`GET /api/events?token=<jwt>` instead of relying on polling. For a single
instance this works out of the box. To run multiple backend instances, replace
the in-memory `Subject` in `RealtimeService` with a Redis pub/sub adapter so
events fan out across processes.

## 5. Push notifications (mobile)

The backend sends Expo push notifications when a user has registered a
`pushToken`. The mobile app registers automatically after login
(`mobile/src/push.ts`). For production builds:

- Configure EAS and add your `projectId` under `expo.extra.eas.projectId`.
- For raw APNs/FCM (without Expo's service), set `EXPO_ACCESS_TOKEN` and follow
  Expo's credentials guide.

## 6. Security middleware

- `helmet` sets secure HTTP headers (enabled in `main.ts`).
- `@nestjs/throttler` applies global rate limiting (default 120 req/min/IP).
- CORS is restricted to `PUBLIC_WEB_URL` in production — set it explicitly.
- Terminate TLS at your load balancer / reverse proxy (HTTPS only); redirect
  HTTP → HTTPS and enable HSTS.

## 7. Audit & compliance

- Admins can export the activity log as CSV from `GET /api/reports/admin/audit`.
- The privacy policy (`/privacy` on the web app) discloses administrator access
  to communication records — keep it linked from sign-up and the footer.

## 8. Backups & monitoring

- Enable automated daily Postgres backups with point-in-time recovery and test
  restores regularly.
- Version and lifecycle-protect the media bucket.
- Add uptime checks on `/api` and error/performance monitoring (Sentry,
  Datadog, or your APM of choice).
- Ship structured logs to a central aggregator and alert on 5xx spikes.

## 9. Tests

```bash
cd backend
npm run test:e2e   # covers register → purchase → payment → usage → meeting
```

Run the suite against a disposable test database in CI before each deploy.

## Marketplace and dedicated tenant portal deployment notes

Deploy three web-facing surfaces:

- API: backend NestJS service.
- Main app: `web/` for tenant portal/admin/consultant/client surfaces.
- Marketplace app: `marketplace/` for global discovery and onboarding.

Important environment checks:

- `NEXT_PUBLIC_API_URL` must point each frontend to the live API.
- `PLATFORM_ROOT_DOMAIN` / `NEXT_PUBLIC_ROOT_DOMAIN` must match the production root domain used for tenant subdomains.
- Custom domains should point to the frontend and resolve through `Tenant.customDomain`.
- Run `npx prisma migrate deploy && npx prisma generate` before backend build/start.

Post-deploy smoke tests:

1. Marketplace `/` loads global catalog.
2. Marketplace `/onboard` works and creates unlisted tenants.
3. Dedicated tenant domain resolves correct branding and has no onboarding CTA/form.
4. Main admin can update feature flags, platform fee %, and dedicated portal flag.
5. Tenant admin sees only own packages/courses/books/revenue.
6. Audit log and CSV export work from main admin.

## 10. Security verification checklist

Before release, verify these runtime items in the real environment:

- Auth cookie works over HTTPS with `httpOnly`, `secure`, and `sameSite=lax`.
- API and frontend are on approved origins only; CORS credentials work as expected.
- Database connection uses TLS/SSL and the DB is not publicly exposed.
- Reverse proxy/load balancer enforces HTTPS and preserves `X-Forwarded-For`.
- GHL / third-party sync is configured with `GHL_SYNC_INCLUDE_PHONE=false` and `GHL_SYNC_INCLUDE_NOTES=false` unless explicitly required.
- Large upload abuse is constrained by `MAX_UPLOAD_BYTES` and any gateway/proxy body-size limits.
- If Redis-backed rate limiting is required for multi-instance deployment, `REDIS_URL` is configured and verified.
