# Consult Hub - Architecture & Delivery Plan

## 1. Recommended architecture

```
          +-------------------+        +-------------------+
          |   Web portal      |        |   Mobile app      |
          |   Next.js 14      |        |   Expo / RN       |
          |  (Admin/Consult/  |        | (Consultant/      |
          |   Client)         |        |  Client)          |
          +---------+---------+        +---------+---------+
                    |   HTTPS (JWT Bearer)        |
                    +--------------+--------------+
                                   |
                          +--------v--------+
                          |  NestJS REST API |
                          |  (modular)       |
                          +--------+--------+
                                   |
         +-------------------------+-------------------------+
         |              |               |                   |
   +-----v----+   +-----v-----+   +-----v-----+      +------v------+
   | Postgres |   |  File     |   |  PayFast  |      |  SMTP/email |
   | (Prisma) |   |  storage  |   |  gateway  |      |  provider   |
   +----------+   +-----------+   +-----------+      +-------------+
```

### Why this stack
- **NestJS + Prisma + PostgreSQL** - typed, modular, well-suited to RBAC, usage metering and relational data (purchases, allowances, meetings).
- **Next.js (App Router)** - one codebase for the three web portals (Admin / Consultant / Client) with role-based routing.
- **Expo (React Native)** - single codebase builds both Android (APK) and iOS apps for **Consultant + Client**, distributed directly without app stores.
- **Provider pattern** - PayFast and email are env-driven with safe mock fallbacks so the system runs end-to-end before live credentials exist.

## 2. Communication security model

- All transport over **HTTPS/TLS**.
- **JWT** access tokens (Bearer), bcrypt-hashed passwords, **OTP** for register/login/reset.
- **Role-based access control** guards every endpoint; participants-only checks on conversations and meetings.
- Media files served from a controlled upload directory (swap for S3-compatible storage + signed URLs in production).
- **Admin access to records**: by design the Admin role can audit communication records, meeting schedules and payment history for compliance/oversight, as specified in the requirements. This is enforced server-side (admin-only report and listing endpoints) and should be disclosed in the user privacy policy.
- **Activity logs** capture key auth and account events.

## 3. Usage metering

Each purchase snapshots the package limits at purchase time. A central **UsageService** checks remaining allowance before every text/audio/video message and consumes a live-session credit on meeting approval. A `null` limit means **unlimited**. Audio/video duration caps (e.g. 60/90/120s) are enforced per package.

## 4. Phased delivery plan

> Cost ranges are indicative for a single small delivery team and will vary by region, rate and scope changes.

### Phase 1 - MVP (core, ~4-6 weeks)
- Auth (JWT + OTP), roles, admin account management.
- Packages (one-time + mentorship) with configurable limits.
- Text messaging with usage tracking + history.
- One-time + subscription purchase via PayFast (+ mock fallback), invoices.
- Meeting booking + approval, consultant availability.
- In-app + email notifications.
- Web portal (Admin/Consultant/Client) + basic mobile (Consultant/Client).
- **Indicative range: $6k-$12k.**

### Phase 2 - Rich media & communities (~3-4 weeks)
- Audio + video messaging with duration limits and recording/upload/playback.
- Communities (free/paid, posts, comments).
- Calendar reminders, reschedule flows, richer reporting/analytics.
- Mobile feature parity + APK / ad-hoc iOS builds.
- **Indicative range: $4k-$9k.**

### Phase 3 - Scale & polish (~3-5 weeks)
- Live audio/video calling (WebRTC), push notifications.
- Cloud media storage with signed URLs, full audit dashboards.
- Advanced analytics, multi-currency, white-labeling.
- Hardening, load testing, formal QA + documentation.
- **Indicative range: $5k-$12k.**

### Cross-phase (ongoing)
- Hosting/infra (DB, app servers, storage, email/PayFast fees).
- Maintenance & support retainer.

## 5. Deliverables checklist
- [x] UI/UX (web portals + mobile app)
- [x] Web portal + admin panel
- [x] Consultant + Client mobile app (Expo)
- [x] Backend API + database schema + seed
- [x] PayFast payment integration (+ mock)
- [x] Technical docs (this file + README)
- [x] User manual (USER_MANUAL.md)
- [x] Docker deployment config
- [ ] Production hosting + live credentials (client-provided)
