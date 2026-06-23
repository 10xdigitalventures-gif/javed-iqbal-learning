# Project Review & Fixes

## Source checked

- `App.pdf`: Consultant & Mentorship Platform requirements, 9 pages.
- `consultant-platform-complete.zip`: monorepo with NestJS backend, Next.js web portal, and Expo mobile app.

## Critical errors found and fixed

1. **Missing web components**: `@/components/shell` and `@/components/chat` were imported but absent, breaking the web app build. Added both components.
2. **Missing Admin route**: login redirects admins to `/admin`, but no `/admin` page/layout existed. Added admin layout and dashboard.
3. **Incorrect backend production script**: `start:prod` pointed to `dist/src/main.js`; Nest builds to `dist/main.js`. Fixed script.
4. **Missing backend dependencies**: media upload used `multer`, and runtime used `express`, but they were not declared directly. Added `express`, `multer`, and `@types/multer`.
5. **Missing mobile dependency**: mobile API imports `expo-constants`, but package.json did not include it. Added `expo-constants`.
6. **PayFast webhook parsing gap**: PayFast posts form data. Added URL-encoded parser support.
7. **Unsafe conversation creation**: non-client users could start conversations using their own ID as `clientId`. Added active-client enforcement.
8. **Meeting package validation gap**: booking with an explicit purchase did not confirm active status or consultant ownership. Added validation.
9. **Double session consumption risk**: approving an already approved meeting could consume sessions again. Added guard.
10. **Media upload validation**: upload endpoint accepted missing/unsupported files. Added required-file and allowed-type checks.

## Improvements added

- Admin dashboard with platform KPIs and revenue summary.
- Sidebar shell with role-based navigation and protected routes for Admin, Consultant, and Client portals.
- Text/audio/video-capable web chat panel with upload support and 5-second refresh.
- Accessibility improvements: visible focus states, cursor pointers, smoother 200ms transitions, and reduced-motion support.
- UI icon improvements: package limit emoji icons replaced with Lucide SVG icons.
- Stronger request validation through NestJS `ValidationPipe` whitelist.

## Requirements coverage notes

The project now covers the main PDF requirements at prototype/MVP level: admin control, consultant/client dashboards, packages, messaging, meetings, PayFast integration, notifications, security basics, web portal, and mobile app skeleton.

## Production items — now implemented

All previously "recommended before production" items have been built into the codebase:

1. **Real-time messaging (SSE)** — New `realtime` module (`RealtimeService` event hub + `@Sse()` `/api/events` endpoint with JWT-in-query auth and heartbeat). Messaging and notifications now emit live events; the web chat subscribes via `EventSource` and falls back to a slow 30s poll only if SSE is unavailable.
2. **Object storage with signed URLs** — New `StorageService` supports a `local` driver (HMAC-signed, expiring `/api/media/file/:key` links) and an `s3` driver (manual SigV4 presigned GETs for S3/R2/B2/MinIO, no SDK). Media uploads return short-lived signed URLs; `/api/media/sign` re-signs expired links.
3. **Server-side media duration** — New `MediaService.probeDurationSec()` uses `ffprobe` to verify audio/video duration on the server instead of trusting the client.
4. **Mobile push notifications** — New backend `PushService` sends Expo push messages; users register a `pushToken` (new `User.pushToken` column, `POST /api/users/me/push-token`). The mobile app registers automatically after login (`mobile/src/push.ts`) and clears the token on logout.
5. **E2E tests** — `backend/test/app.e2e-spec.ts` + `jest-e2e.json` cover register/login → package → purchase → payment → usage → message → meeting approval, wired to a new `test:e2e` script.
6. **Privacy policy** — New `/privacy` web page explicitly discloses administrator access to client–consultant communications.
7. **Security & ops hardening** — `helmet` secure headers, global `@nestjs/throttler` rate limiting, production-restricted CORS (`PUBLIC_WEB_URL`), and an admin audit-log CSV export (`GET /api/reports/admin/audit`).
8. **Deployment guide** — New `DEPLOYMENT.md` documents secrets, migrations (`prisma migrate deploy`), storage/push config, HTTPS/TLS, backups, monitoring, the multi-instance SSE Redis note, and how to run the E2E suite.

## Second review pass — additional critical fixes

A further quality/critical review surfaced and fixed these:

11. **Broken auth token contract (critical, pre-existing)** — The backend auth endpoints returned `{ accessToken, user }`, but both the web and mobile clients (and the new E2E suite) read `res.token`. Login/register therefore stored an `undefined` token and every authenticated request would have failed. Standardised the backend to return `{ token, user }`.
12. **Stale media links (critical, introduced by signed-URL work)** — The web chat was storing the _signed, expiring_ upload URL directly on the message, so audio/video would break after the link expired (and immediately under the S3 driver). Now the stable object **key** is persisted on the message and a fresh signed URL is generated on every read (`getConversation` and the real-time SSE payload). Added `StorageService.extractKey()`, a `mediaKey` field on the send DTO (with backward-compatible `mediaUrl` normalisation), wired `MediaModule` into `MessagingModule`, and updated the web upload flow to send `mediaKey` plus the server-verified `durationSec`.

13. **Public media leak (critical security, pre-existing)** — `main.ts` served the entire upload directory at a public, unauthenticated `/uploads` static route, which defeated the new signed-URL access control (anyone could enumerate/download private client–consultant audio/video). Removed the static route entirely; all media now flows only through signed, expiring URLs (`GET /api/media/file/:key` for local, presigned GET for S3).

Note: the mobile chat screen still uses a short poll for new messages because React Native has no built-in `EventSource`; this is acceptable and documented (add an SSE polyfill later if desired). Mobile notifications already use Expo push.

### Remaining operational step (environment-dependent)

- New dependencies were added to `backend/package.json` (`helmet`, `@nestjs/throttler`, jest/supertest/ts-jest) and `mobile/package.json` (`expo-notifications`, `expo-device`). Run `npm install` in each app, then `npx prisma migrate deploy` (the schema adds `User.pushToken`) in a connected environment before building/running. All TypeScript was validated for syntax (122 files, 0 errors); type-checking and builds require the installed dependencies.

## Third pass — plans × consultants, channels, and gateway refactor

This pass implements five product changes requested for the platform. No
breaking fixes were needed; the work is additive plus a payment-provider
refactor.

### 1. Plans ↔ consultants (many-to-many) + global plans

- Schema: implicit M2M `Package.consultants User[]` ↔ `User.packages Package[]`
  (relation `"PackageConsultants"`, join table `_PackageConsultants`) plus
  `Package.isGlobal Boolean @default(false)`.
- Admin package form: multi-select consultants + an “Available with all
  consultants (global)” toggle. Editing a package is now supported (PATCH).
- Client: a consultant's profile (`/client/consultants` → View plans) and the
  package browser filter show only that consultant's assigned plans plus any
  global plans, via `GET /packages/consultant/:consultantId`.
- Purchase validation: `PurchasesService.create` now rejects a purchase unless
  the package is active and either `isGlobal` or assigned to the chosen
  consultant.

### 2. Separate text / audio / video plans

- Schema: `enum PackageChannel { TEXT AUDIO VIDEO COMBINED }`, `Package.channel`
  (default `COMBINED`). Admins create single-channel or combined plans.
- Usage semantics: a blank limit = unlimited, `0` = not allowed. The service
  forces disallowed channels to `0` based on the selected channel.
- New `UsageService.remainingAllowance(clientId, consultantId)` aggregates the
  client's remaining text/audio/video/session allowance across active,
  non-expired purchases (including global plans). Exposed at
  `GET /purchases/allowance?consultantId=`.
- Chat composer: Text/Audio/Video tabs; only channels with remaining allowance
  are enabled, others are disabled with a “buy a plan for this channel” hint.

### 3. Wipe existing plans

- The migration clears existing `Package`/`Purchase`/`Payment` rows (FK-safe,
  nulling `Message.purchaseId`/`Meeting.purchaseId`) and the seed recreates four
  fresh plans (text, audio, video, and a global combined plan) assigned to the
  demo consultants.

### 4. PayFast → GoPayFast

- Removed the PayFast provider. Added `GoPayFastProvider`: one-time access token
  (`GetAccessToken`) → hosted-checkout via a self-submitting `PostTransaction`
  form with success/failure URLs, confirmed by IPN
  (`POST /payments/webhook/gopayfast`). UAT vs live base URL is chosen by
  `GOPAYFAST_MODE`.

### 5. Whop + provider abstraction

- Introduced `interface PaymentProvider { createCheckout, handleWebhook }` and a
  `PaymentProvidersService` registry controlled by `PAYMENT_PROVIDERS`.
  Implemented `GoPayFastProvider`, `WhopProvider`, and `MockProvider` (always
  available for dev). Whop uses a checkout session and verifies the
  `x-whop-signature` HMAC over the raw body (`payment.succeeded` → paid).
- The client chooses a gateway at checkout (`GET /payments/providers`,
  `POST /payments/checkout/:paymentId { gateway }`). `main.ts` enables `rawBody`
  for webhook signature verification. The webhook is the source of truth.

### 6. UI polish

- Reusable `ChannelBadge` (icon + label per channel) on admin and client plan
  cards; consultant filter and gateway picker on the client package browser;
  channel tabs with disabled/locked states in the chat composer; empty states
  and clearer assignment summaries on admin cards. SVG (lucide) icons,
  `cursor-pointer`, focus-visible rings, and 200ms transitions throughout.

### New / changed env vars

`PAYMENT_PROVIDERS`, `GOPAYFAST_MERCHANT_ID`, `GOPAYFAST_SECURED_KEY`,
`GOPAYFAST_MODE` (+ optional `GOPAYFAST_API_BASE`, `GOPAYFAST_MERCHANT_NAME`),
`WHOP_API_KEY`, `WHOP_COMPANY_ID`, `WHOP_WEBHOOK_SECRET` (+ optional
`WHOP_API_BASE`). See `DEPLOYMENT.md` and `backend/.env.example`.

### Validation note

The sandbox has no network access, so dependency-resolving builds
(`next build`, `tsc`, `prisma migrate`) cannot run here. All new/edited files
were syntax-checked with Prettier and reviewed for self-consistency (matching
API shapes between backend and web, e.g. `{ url }` from checkout and
`{ providers }` from the gateway list).
