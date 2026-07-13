# Final Full Codebase Audit Report

## Scope of this audit

This report is not limited to integrations. It reviews the whole codebase globally against the platform scope discussed earlier:

- Global marketplace
- Dedicated tenant portals
- Tenant admin
- Admin panel
- Client/consultant apps
- Mobile app
- Multi-role accounts
- White-label branding
- Full audit logs
- Enterprise-level completeness
- Connected frontend/backend flows
- Code that exists but may be half-wired or not production-complete

## Repository areas checked

| Area               | Folder               | Status                                                                  |
| ------------------ | -------------------- | ----------------------------------------------------------------------- |
| Backend API        | `backend/src`        | Large feature set present; runtime build still needs dependency install |
| Main web app       | `web/src`            | Admin/client/consultant/tenant-admin surfaces present                   |
| Marketplace app    | `marketplace/src`    | Public marketplace + onboarding present                                 |
| Mobile app         | `mobile/src`         | Client/mobile learning app present with white-label config              |
| Mobile marketplace | `mobile-marketplace` | Separate Expo shell exists; not as complete as main mobile app          |
| Docs               | root docs + `docs/`  | Many docs exist; some old wording remains                               |
| Automation         | `automation`         | Watch/deploy helper exists                                              |

## Executive summary

The platform has a broad enterprise-level codebase. Most major modules exist and are connected at a structural level:

- Marketplace onboarding and catalog exist.
- Tenant model and tenant context exist.
- Tenant admin exists.
- Admin panel is broad.
- Client and consultant portals exist.
- Mobile app is feature-rich.
- Payments, content, messaging, meetings, communities, notifications, reports, audit logs and settings exist.
- White-label branding and mobile app config were added.
- Multi-role account foundation and UI were added.

However, the audit found several areas where code exists but is likely not fully production-complete or has old/copy-pasted endpoints/text that need cleanup.

The biggest practical risks are:

1. Runtime build was not completed because dependency install got stuck in sandbox.
2. Tenant-admin e-book UI still calls several admin/global book endpoints instead of the new tenant-admin scoped endpoints.
3. Tenant-admin course page is still basic list/create/delete; full advanced course builder remains in admin route only.
4. Some old docs/UI text still say PayFast/SMTP/mock/coming soon in places where wording should be updated or feature completed.
5. SMTP path is still not a real SMTP send implementation.
6. Mobile marketplace appears lighter/less complete than the main mobile app.
7. Several enterprise features are code-present but need real environment QA: payments, storage, email, push, EAS, DNS/SSL.

## Global feature audit

### 1. Marketplace

**Code found**

- `marketplace/src/app/page.tsx`
- `marketplace/src/app/onboard/page.tsx`
- `marketplace/src/app/expert/[slug]/page.tsx`
- `marketplace/src/components/global-catalog.tsx`
- Backend marketplace module/controller/service.

**Status**: Mostly complete structurally.

**Working-looking flow**

- Main marketplace fetches `/marketplace/catalog`.
- Onboarding posts to `/tenant/onboard`.
- Expert details fetch tenant public profile/catalog.

**Remaining risks**

- Needs runtime test with real backend.
- Old docs still contain some stale marketplace/directory wording in audit docs.

### 2. Dedicated tenant portal

**Code found**

- Tenant model contains slug/custom domain/branding/module flags.
- `TenantContextMiddleware` exists.
- `web/src/lib/branding.tsx` loads `/tenant/current`.
- Tenant public APIs exist.

**Status**: Foundation complete; storefront depth needs QA.

**Important rule verified**

- Onboarding is on marketplace, not tenant portal.

**Remaining risks**

- Dedicated tenant storefront pages are less clearly separated than admin/client pages.
- Need live host/subdomain/custom-domain smoke tests.

### 3. Tenant admin

**Code found**

- `web/src/app/tenant-admin/*`
- `backend/src/tenant/tenant-admin.controller.ts`

**Status**: Partially complete to good level.

**Completed pieces**

- Dashboard/revenue.
- Branding.
- Mobile app config.
- Packages.
- Courses basic list/create/delete.
- Books/e-books basic management.
- Scoped backend routes for courses/modules/lessons/books/chapters were added.

**Main issue found**

`web/src/app/tenant-admin/ebooks/page.tsx` still calls admin/global endpoints in several places:

- `/books/${bookId}/chapters/admin`
- `/books/${bookId}/chapters`
- `/chapters/${c.id}`
- `/books/${bookId}/chapters/reorder`
- `/books/import-pdf`
- `/books/import-jobs/${jobId}`
- `/books/${editing.id}`
- `/books`
- `/categories`

Some backend tenant-admin scoped routes were added, but frontend has not been fully switched to them.

**Required fix**

- Replace tenant-admin e-book frontend calls with `/tenant-admin/books/...` routes.
- Add any missing tenant-admin routes for reorder/delete/import if tenant admins should use those features.
- Or hide/disable advanced import/reorder/category controls for tenant admins until scoped routes exist.

### 4. Admin panel

**Code found**

Admin routes include:

- Audit
- Team
- Users
- Consultants
- Clients
- Courses
- E-books
- Bundles
- Packages
- Payments
- Revenue
- Reports
- Reconciliation
- Settings
- Support
- Media
- Notifications
- Tenant features
- Attribution
- Communities

**Status**: Broad and feature-rich.

**Remaining risks**

- Admin course builder has some “coming soon”/placeholder sections.
- Needs build/runtime test because it is a very large page.
- Some old wording still says PayFast in places where actual provider key is `gopayfast`; label may be acceptable for user-facing name but docs should be consistent.

### 5. Client portal

**Code found**

Client routes include:

- Dashboard
- Explore
- Courses
- Course detail/lesson player
- Library/book reader
- Audiobooks
- Packages
- Consultants
- Meetings
- Messages
- Payments
- Subscription
- Notifications
- Achievements
- Support
- Communities
- Certificates

**Status**: Broad and mostly connected-looking.

**Remaining risks**

- Needs full API runtime QA.
- Needs real entitlement/access testing after purchase.
- Needs media playback/signed URL testing.

### 6. Consultant portal

**Code found**

Consultant routes include:

- Dashboard
- Availability
- Clients
- Meetings
- Messages
- Notifications
- Support
- Communities

**Status**: Present and connected-looking.

**Remaining risks**

- Role switching now exists, but final backend guard behavior must be tested with real JWT/session.
- Consultant as tenant admin + consultant same account needs real user/tenant role data test.

### 7. Mobile app

**Code found**

Main mobile app includes:

- Home
- Explore/search
- Courses/course detail/lesson detail
- Books/reader/audiobooks
- My learning/library
- Communities
- Chat/messages
- Meetings
- Notifications
- Devices
- Certificates
- Support
- Bank transfer/checkout
- Offline secure content helpers
- Push token registration
- Tenant config/branding

**Status**: Feature-rich, but mobile runtime not tested here.

**Remaining risks**

- Actual Expo/EAS build required.
- Real device QA needed for video/audio/download/offline/push.
- `mobile-marketplace` looks more like a lighter shell and should not be considered equal to the main mobile app unless intentionally separate.

## Enterprise scope checklist

| Enterprise scope item        | Status                  | Notes                                                                             |
| ---------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| Marketplace-only onboarding  | Done                    | Onboarding in marketplace app                                                     |
| Global marketplace catalog   | Mostly done             | Uses `/marketplace/catalog`                                                       |
| Dedicated tenant portal      | Partial/good foundation | Needs host/domain smoke test                                                      |
| Tenant admin portal          | Partial/good            | Basic CRUD + branding/mobile/revenue; e-book advanced endpoint mismatch remains   |
| White-label branding         | Mostly done             | URL-based assets; upload picker still not fully self-service                      |
| Mobile white-label           | Config generator done   | Actual EAS build external                                                         |
| Multi-role accounts          | Foundation + UI done    | Needs runtime auth/guard test                                                     |
| Full audit logs              | Strong start            | Global interceptor + retention; explicit before/after only for branding so far    |
| One-month retention          | Code added              | Needs runtime validation                                                          |
| Admin audit UI/export        | Done-looking            | Needs real data QA                                                                |
| Tenant-scoped CRUD           | Partial                 | Packages/courses/books backend scoped; tenant e-book frontend still old endpoints |
| Course builder tenant-scoped | Partial                 | Backend scoped module/lesson routes exist; tenant UI still basic                  |
| E-book builder tenant-scoped | Incomplete              | Frontend still calls admin/global endpoints                                       |
| Payments                     | Connected               | Needs real gateway test                                                           |
| Email/SMS/push               | Partial/connected       | SMTP/SMS need production provider validation                                      |
| Storage/media                | Connected               | Needs selected provider runtime test                                              |
| Reports/reconciliation       | Connected-looking       | Needs real data QA                                                                |
| Security/audit               | Good foundation         | Needs production hardening/build tests                                            |

## Code-level issues found

### Issue 1: Tenant admin e-books are not fully tenant-scoped in frontend

This is the most important codebase mismatch found.

The backend now has some `/tenant-admin/books/...` routes, but the tenant admin e-book page still uses many `/books/...`, `/chapters/...`, and `/categories/...` admin/global endpoints.

**Risk**

- Tenant admin might hit admin-only APIs and fail authorization.
- Or worse, tenant admin might access non-tenant scoped resources if backend route allows it.

**Recommendation**

Create a dedicated tenant e-book manager or fully convert endpoints:

- `GET /tenant-admin/books/:idOrSlug`
- `POST /tenant-admin/books/:idOrSlug/content`
- `GET /tenant-admin/books/:bookId/chapters/admin`
- `POST /tenant-admin/books/:bookId/chapters`
- `PATCH /tenant-admin/books/chapters/:id`
- Add missing delete/reorder/import endpoints under tenant-admin if needed.

### Issue 2: Tenant admin courses are basic compared to admin course builder

Tenant admin course page currently uses basic list/create/delete routes. The full builder is in admin course detail route.

**Risk**

Tenant admin can create a course but may not be able to fully manage modules, lessons, quizzes, assignments, offers, reviews, comments and live sessions from the tenant admin UI.

**Recommendation**

Either:

- Create `/tenant-admin/courses/[id]` builder using tenant-admin scoped APIs, or
- Hide tenant-admin course creation until admin handles course construction.

### Issue 3: Some old docs and labels still mention PayFast instead of GoPayFast/PayFast PK consistently

Found in:

- `README.md`
- `ARCHITECTURE.md`
- some comments/UI labels

This is partly acceptable because GoPayFast is PayFast PK user-facing gateway, but docs should clarify naming.

**Recommendation**

Use one convention:

- User-facing: “PayFast PK / GoPayFast”
- Technical provider key: `gopayfast`

### Issue 4: SMTP path is detected but not implemented

Mail service says SMTP is enabled when `SMTP_HOST` exists, but actual SMTP sending is not implemented.

**Recommendation**

Either implement SMTP with nodemailer or remove SMTP from docs and only support SendGrid.

### Issue 5: Some UI sections still say “coming soon”

Found examples:

- Admin course detail has placeholder/coming soon sections.
- Mobile explore says curated collections are coming soon.

**Recommendation**

Either complete those sections or clearly mark them as intentionally out-of-scope for v1.

### Issue 6: Runtime build cannot be confirmed from sandbox

Dependency install got stuck earlier, so full TypeScript/Nest/Next/Expo build was not completed here.

**Recommendation**

Run in a real dev/server environment:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run test:e2e
```

```bash
cd web
npm install
npm run build
```

```bash
cd marketplace
npm install
npm run build
```

```bash
cd mobile
npm install
npx expo-doctor
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

## Recommended next engineering order

### Priority 1 — Fix tenant admin e-book endpoint mismatch

This should be fixed before handing tenant-admin access to real tenants.

### Priority 2 — Build tenant admin course builder

Add `/tenant-admin/courses/[id]` using the scoped backend routes.

### Priority 3 — Complete SMTP or remove SMTP promise

Either implement SMTP or document SendGrid-only email.

### Priority 4 — Clean old docs/text

Update `README.md`, `ARCHITECTURE.md`, old audit docs and labels so they do not confuse PayFast/GoPayFast, tenant directory, or mock mode.

### Priority 5 — Runtime build/test

Run full builds in an environment where dependencies can install.

### Priority 6 — Production QA flows

Test real flows:

1. Marketplace onboarding.
2. Tenant approval/configuration.
3. Tenant admin branding/domain/mobile config.
4. Tenant creates course/book/package.
5. Marketplace catalog shows tenant content.
6. Client buys content.
7. Payment webhook activates access.
8. Client uses web/mobile content.
9. Audit logs show all key actions.
10. Tenant/admin revenue reports match payment data.

## Final plain-English explanation for handoff

This platform is a complete multi-tenant marketplace and white-label learning/consultation system. It has:

- A public marketplace where consultants/businesses can be discovered and onboarded.
- A tenant system where each approved business can have its own branded portal and custom domain.
- Admin tools for users, tenants, settings, payments, revenue, audit logs, reports and support.
- Tenant admin tools for branding, mobile app setup, courses, books, packages and revenue.
- Client tools for buying and consuming courses, books, communities, meetings and messaging.
- Consultant tools for clients, meetings, availability and messaging.
- A mobile app with learning, books, messages, communities, support and white-label configuration.
- Full backend audit logging to track user actions.
- Multi-role user support so a person can act as tenant admin and consultant.

The codebase is broad and close to the intended enterprise scope, but before production handoff the most important code cleanup is tenant-admin e-books/course-builder scoping, followed by real build/testing and provider credential validation.

## Completion update after next-step fixes

The following high-priority codebase issues were addressed in the next-step completion pass:

- Tenant-admin e-books frontend was rewired away from admin/global book mutation endpoints and now uses tenant-admin scoped book/chapter routes for load, save, delete, reorder and PDF import polling.
- Tenant-admin backend gained missing scoped book routes for chapter delete, chapter reorder, PDF import and import-job polling.
- Tenant-admin book category management was made read-only in the tenant UI so tenants no longer mutate platform-global categories from their portal.
- A tenant-admin course detail builder page was added at `/tenant-admin/courses/[id]` for scoped course details, modules and lessons.
- Tenant course list now points Manage to the tenant-admin course builder instead of the admin-only course page.
- README / architecture wording was cleaned so user-facing docs align better with GoPayFast / PayFast PK and current email behavior.

Remaining items are now mostly runtime/environment validation and optional deeper enhancements, not the original high-priority scoping mismatches.
