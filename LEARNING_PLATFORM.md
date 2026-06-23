# Prof. Dr. Javed Iqbal Learning App

This document describes the **Learning Platform** layer that extends the
existing Consult Hub codebase (NestJS API + Next.js web + Expo React Native
mobile) into a premium **LMS + Digital Library + Community + Messaging**
platform. It was built **on top of** the existing app - all prior messaging,
consultation, meetings and payment features are preserved.

## Approach

This is a large, multi-phase product. **Phase 1 (Books)** is implemented
end-to-end (data model, backend APIs, secure offline reading, mobile UI). The
architecture is intentionally future-ready: Courses, Lessons, Quizzes,
Assignments and Certificates exist as scalable data models and the activity
tracker already accepts course/video/quiz events, so those features slot in
without rework.

| Area | Status |
| --- | --- |
| Data model (books, bundles, plans, subscriptions, orders, entitlements, offline content, reading progress, bookmarks/highlights/notes, activity logs, hard-copy orders, community likes) | ✅ Phase 1 |
| Backend APIs (books, library, subscriptions, orders, payments, hardcopy, activity, communities) | ✅ Phase 1 |
| Secure offline reading (server-side AES-256-GCM + on-device re-encryption) | ✅ Phase 1 |
| Mobile app (6-tab navigation, Home, Library, Book detail, My Learning, Reader, Community, Profile, Checkout, Hard-copy order) | ✅ Phase 1 |
| Messaging (text + audio/video message types) | ✅ Existing, retained |
| Course system (video lessons, PDFs, quizzes, assignments, certificates) | 🧱 Data models + activity events scaffolded for Phase 2 |
| Web admin panel for the new entities | 🧱 APIs ready; admin UI is a follow-up |

## Branding

The mobile theme (`mobile/src/theme.ts`) uses the requested palette: primary
**orange** (`#FF7A1A`), secondary **black** (`#111114`), and white / light-grey
backgrounds. Cards, progress indicators, pills and empty states follow a clean,
GoKollab-style LMS layout.

## Bottom navigation (mobile)

`Home · Library · My Learning · Community · Messages · Profile`

## Secure offline reading (how it works)

Protected book content is **never delivered as a downloadable PDF**:

1. `GET /library/content/:bookId` requires a valid JWT and verifies the user's
   entitlement (`assertAccess`). It returns the chapter text over TLS only - it
   is an API response, not a file.
2. The server also encrypts the content per-user with AES-256-GCM
   (`CONTENT_ENCRYPTION_KEY`) for future native-decryption clients.
3. On device, `mobile/src/secure.ts` immediately **re-encrypts the content at
   rest** into the app's private storage (hashed filename, per-book key in the
   OS keystore via `expo-secure-store`). It is not exportable, shareable, or
   visible in the device file manager.
4. The reader decrypts in memory only and tracks last-read position so users can
   continue offline.

## Payments (Pakistani PayFast)

The Pakistani PayFast gateway (**GoPayFast**, gopayfast.com) is integrated via
the existing payments module: payment creation (`POST /orders`), checkout URL
(`POST /payments/checkout/:id`), in-app **WebView** checkout
(`CheckoutScreen`), webhook handling (`POST /payments/webhook/gopayfast`),
verification and transaction history (`GET /payments/mine`). On payment success
the webhook fulfils the order and the entitlement unlocks automatically. See
`backend/.env.example` for credential mapping. **No keys are hardcoded.**

## Activity tracking & offline sync

`mobile/src/activity.ts` records every learning action (book opened, chapter
read, %, time, bookmarks, notes). Events are sent to `POST /activity`; if
offline they queue locally and flush via `POST /activity/sync` automatically
when connectivity returns (also on app foreground). The event shape already
supports future course/video/quiz/assignment events.

## Running the new backend

```bash
cd backend
cp .env.example .env            # then fill secrets (never commit them)
npm install
npx prisma generate
npx prisma migrate dev --name learning_platform
npm run seed                    # seeds demo books, bundles, plans, community
npm run start:dev
```

## Mobile

```bash
cd mobile
npm install
npx expo start
```

New dependencies: `expo-file-system`, `expo-secure-store`, `expo-crypto`,
`react-native-webview`, `expo-av`, `@expo/vector-icons`.

## Roadmap (Phase 2+)

- Web admin UI for books/bundles/plans/orders/analytics (APIs already exist).
- Course player: in-app encrypted video streaming (no direct download), quizzes,
  assignments, certificates (models scaffolded).
- Community groups, post likes endpoint, and mentor/student messaging spaces.
