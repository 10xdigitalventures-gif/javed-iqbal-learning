# Consult Hub - Consultant & Mentorship Platform

A secure platform connecting **Consultants** and **Clients** for one-time consultations and recurring mentorship programs, with text/audio/video messaging, meeting scheduling, communities, and PayFast payments.

## Monorepo structure

```
consultant-platform/
  backend/    NestJS 10 + Prisma 5 + PostgreSQL REST API
  web/        Next.js 14 (App Router) web portal (Admin + Consultant + Client)
  mobile/     Expo (React Native) app for Consultants + Clients
```

## Roles

- **Admin** - full control: manage consultant/client accounts, service packages, mentorship programs, communities, subscriptions, payments, reports, platform settings.
- **Consultant** - view assigned clients, respond to text/audio/video messages, see package utilization, manage availability, approve/reschedule meetings.
- **Client** - register/login, purchase consultation + mentorship packages, message consultants, book meetings, join communities.

## Core features

- **Service model**: One-Time Consultation + Mentorship Programs (monthly / annual / custom). Every limit (text/audio/video messages, live sessions, durations) is admin-configurable. Leave a limit blank for **unlimited**.
- **Messaging**: real-time-ish (5s polling) text + recorded audio/video, with duration limits and per-package usage tracking.
- **Meetings**: consultant weekly availability, client booking, approval/reschedule, reminders, session history.
- **Communities**: free or paid groups with posts + comments (membership-gated).
- **Payments**: PayFast (Pakistan) for one-time + subscriptions, invoices, history. Falls back to a mock checkout when PayFast keys are absent (great for local dev).
- **Notifications**: in-app + email (email via SMTP, mock-logged when unset).
- **Auth/Security**: JWT, bcrypt password hashing, OTP (register/login/reset), role-based access control, activity logging.

## Quick start (local)

### 1. Backend
```bash
cd backend
cp .env.example .env          # edit DATABASE_URL + JWT_SECRET
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev             # http://localhost:4000/api
```

### 2. Web
```bash
cd web
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                   # http://localhost:3000
```

### 3. Mobile
```bash
cd mobile
npm install
npm run start                 # Expo - press a (Android) / i (iOS)
```
> On Android emulator the API base is `http://10.0.2.2:4000/api` (see `app.json` > extra.apiUrl). For a physical device, set it to your machine's LAN IP.

## Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | Password123! |
| Consultant | consultant@example.com | Password123! |
| Consultant | consultant2@example.com | Password123! |
| Client | client@example.com | Password123! |

## Docker

```bash
docker compose up --build
```
Starts Postgres, the backend (port 4000) and the web portal (port 3000).

## Mobile distribution (no app store)

- **Android**: `eas build -p android --profile preview` produces an installable **APK** you can share directly.
- **iOS**: `eas build -p ios --profile preview` with an ad-hoc / enterprise profile for direct (non-App-Store) distribution.

See `ARCHITECTURE.md` for the full architecture, security model, and the phased delivery plan with cost ranges.
