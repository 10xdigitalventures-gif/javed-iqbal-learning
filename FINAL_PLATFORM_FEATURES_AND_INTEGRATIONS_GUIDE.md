# Final Platform Features & Integrations Guide

This document is written for a normal technical person who needs to understand what the platform does, how it is built, which integrations are connected, and which items still need real credentials/production testing.

## 1. What this platform is

This is a multi-tenant marketplace + white-label learning/consultation platform.

It has three main public/business surfaces:

1. **Global Marketplace**
   - Main public site where customers discover consultants/tenants.
   - Handles tenant/consultant onboarding.
   - Shows global catalog: experts, courses, books, packages.

2. **Dedicated Tenant Portal**
   - A branded portal for each approved tenant/consultant/business.
   - Uses tenant slug or custom domain.
   - Does **not** have public onboarding inside the tenant portal.
   - Shows tenant-specific courses, books, packages, branding, colors, logo and modules.

3. **Admin / Tenant Admin / Consultant / Client Apps**
   - Platform admin manages tenants, users, audit logs, catalog, settings and revenue.
   - Tenant admin manages own branding, mobile app identity, courses, books, packages and revenue.
   - Consultant area is for consultant operations.
   - Client area/mobile app is for learners/buyers.

## 2. Main apps in the repo

| Folder | Purpose |
|---|---|
| `backend` | NestJS API, Prisma database, auth, payments, tenants, marketplace, audit logs, integrations |
| `web` | Main web app: admin, tenant admin, consultant, client portal |
| `marketplace` | Public global marketplace and onboarding site |
| `mobile` | Expo mobile app for branded tenant/client use |
| `mobile-marketplace` | Marketplace/mobile-related app area if used separately |
| `docs` | Deployment, domain, scaling and white-label documentation |

## 3. Feature overview

### Marketplace

- Public expert directory/catalog.
- Public onboarding form for consultants/tenants.
- Slug availability check.
- Global catalog endpoints for experts, books, courses and packages.
- Expert detail pages.
- Links from marketplace to tenant portal/storefront.

### Multi-tenancy

- Tenant model includes slug, custom domain, module flags, listing flag, platform fee and brand fields.
- Tenant context middleware resolves tenant by custom domain or subdomain.
- Tenant public APIs expose tenant profile and tenant catalog.
- Tenant admin APIs are scoped by current user's tenant.

### Tenant admin

Tenant admin can manage:

- Dashboard/revenue.
- Branding and colors.
- Custom domain verification instructions.
- Mobile app white-label configuration.
- Courses.
- Course modules and lessons via scoped APIs.
- Packages.
- Books/e-books.
- Book content and chapters via scoped APIs.

### White-label

Tenant branding supports:

- Brand name.
- Logo URL.
- Dark logo URL.
- Favicon URL.
- Primary/secondary/accent colors.
- Font family.
- Tagline.
- Support email.
- Custom domain.
- Mobile app identity values for EAS builds.

### Audit logs

- Global mutation interceptor logs backend POST/PUT/PATCH/DELETE.
- Captures user, tenant, action, entity, entity ID, IP, user agent, request ID, success/error, duration, sanitized body and result snapshot.
- Sensitive keys are redacted.
- Admin audit UI has filters and export.
- Retention service keeps at least 30 days online logs by default.
- Explicit before/after logging added for tenant branding updates.

### Multi-role accounts

- `UserTenantRole` model allows one user to hold tenant-scoped roles.
- Admin APIs can list/assign/remove tenant roles.
- Admin Team UI can assign/remove tenant roles.
- Auth responses include tenant role memberships.
- Frontend role switcher validates selected role against base role or tenant role membership.

### Mobile app

- Expo app supports white-label env variables.
- Tenant slug and brand color are available at runtime/build time.
- Tenant admin Mobile App page generates EAS environment values.
- Push token registration exists through Expo notifications.
- Offline/secure course/book helpers exist in mobile code.

## 4. Integration audit

### Integration status key

- **Connected** = code path exists and is wired into app modules/UI/API.
- **Credential-dependent** = will work only after environment variables/API keys are configured.
- **Partial** = some code exists but logic is incomplete or needs production validation.
- **Mock/fallback** = safe development fallback exists.

| Integration / service | Status | Where it exists | What is working / what to check |
|---|---|---|---|
| GoPayFast / PayFast PK | Connected, credential-dependent | `backend/src/payments/providers/gopayfast.provider.ts` | Hosted checkout token flow and webhook handler exist. Needs real merchant credentials, sandbox/live testing, callback URL verification and payment reconciliation test. |
| Whop payments | Connected, credential-dependent | `backend/src/payments/providers/whop.provider.ts` | Provider is registered. Needs Whop credentials/webhook validation in real environment. |
| Bank transfer | Connected | `backend/src/payments/providers/bank-transfer.provider.ts` | Manual/offline payment option exists. Needs admin operational process for approving transfers. |
| Mock payments | Connected | `backend/src/payments/providers/mock.provider.ts` | Development fallback so checkout can work without real gateway. Should not be enabled as production default. |
| Payment provider registry | Connected | `backend/src/payments/payment-providers.service.ts` | Uses `PAYMENT_PROVIDERS` env and only exposes enabled providers. Falls back to mock if none configured. |
| SendGrid email | Connected, credential-dependent | `backend/src/mail/mail.service.ts` | Sends through SendGrid when `SENDGRID_API_KEY` is set. Needs real from email/domain authentication. |
| SMTP email | Partial | `backend/src/mail/mail.service.ts` | SMTP env detection exists, but actual SMTP/nodemailer send path is only logged. Needs real SMTP implementation if SMTP is required. |
| Mock email | Connected | `backend/src/mail/mail.service.ts` | Logs email in dev when no provider configured. |
| Expo push notifications | Connected, credential-dependent | `backend/src/notifications/push.service.ts`, `mobile/src/push.ts` | Mobile registers Expo token; backend sends to Expo push endpoint. Needs real device build and push permission testing. |
| SMS | Partial / credential-dependent | `backend/src/notifications/sms.service.ts` | SMS service exists but should be checked with real provider credentials and message templates before production. |
| LeadConnector / GoHighLevel OAuth | Connected, credential-dependent | `backend/src/leadconnector`, `backend/src/ghl-sync` | OAuth begin/callback/token storage flow exists. Needs real LeadConnector app client ID/secret, redirect URI setup and token refresh/sync validation. |
| LeadConnector MCP | Connected-looking, credential-dependent | `backend/src/leadconnector/leadconnector-mcp.service.ts` | MCP/service code exists. Needs actual credentials and permission testing. |
| Storage: Supabase | Connected, credential-dependent | `backend/src/storage/supabase.provider.ts` | Provider selectable. Needs bucket/key/env setup. |
| Storage: Bunny | Connected, credential-dependent | `backend/src/storage/bunny.provider.ts` | Provider selectable. Needs zone/key/env setup. |
| Storage: S3 | Connected, credential-dependent | `backend/src/storage/s3.provider.ts` | Dependency-free S3 compatible provider exists. Needs AWS/B2/MinIO credentials and signed URL test. |
| Storage: Cloudflare R2 | Connected, credential-dependent | `backend/src/storage/r2.provider.ts` | R2 provider exists. Needs account/bucket/access key setup. |
| Media upload/download | Connected | `backend/src/media`, `backend/src/storage` | Media module uses storage service. Needs large-file and signed URL testing with selected provider. |
| Custom domains / DNS | Connected + production-dependent | `backend/src/tenant`, `docs/custom-domain-setup.md`, tenant branding UI | Tenant custom domain and CNAME instructions exist. SSL/DNS can only be validated in production DNS/hosting. |
| Mobile EAS builds | Config generator connected; build execution external | `mobile/app.config.js`, `mobile/eas.json`, `/tenant-admin/mobile-app` | Tenant admin can generate env values. Actual EAS build requires Expo/EAS account, project IDs and app-store credentials. |
| Offline secure content | Code exists | `mobile/src/offlineCourseSecure.ts`, `mobile/src/secure.ts` | Offline token/secure storage helpers exist. Needs real mobile QA on iOS/Android devices. |
| AI service | Connected-looking, credential-dependent | `backend/src/ai` | AI module exists. Needs actual provider key/model configuration check before production. |
| Reports / exports | Connected | `backend/src/reports`, `backend/src/activity` | CSV/export code exists. Needs data validation with real records. |
| Reconciliation / payouts | Connected-looking | `backend/src/reconciliation`, `backend/src/payouts` | Revenue reconciliation/payout services exist. Needs real transaction/payment data testing. |

## 5. Integration gaps found

These are not blockers for understanding the platform, but they are important before production.

### 5.1 SMTP is half-created

The mail service checks `SMTP_HOST`, but it does not actually send SMTP mail. It logs a message instead.

**Fix needed if SMTP is required:** add nodemailer or another SMTP client and test SMTP credentials.

### 5.2 Payment gateways need real sandbox/live testing

GoPayFast code has hosted checkout and webhook handling, but no real gateway test was completed in this sandbox.

**Fix/check needed:** run a sandbox transaction, verify webhook signature fields, verify payment status update, verify purchase activation and reconciliation.

### 5.3 LeadConnector needs real OAuth app testing

OAuth code exists, but it needs real `LEADCONNECTOR_CLIENT_ID`, `LEADCONNECTOR_CLIENT_SECRET`, approved redirect URI and location permissions.

**Fix/check needed:** complete OAuth connect, verify token storage, fetch location name, refresh/sync if applicable.

### 5.4 SMS provider needs final provider confirmation

SMS service exists, but production readiness depends on selected SMS provider, credentials and templates.

**Fix/check needed:** configure provider and send a test OTP/notification.

### 5.5 Storage provider must be selected and tested

Multiple storage providers exist, but production should choose one.

**Fix/check needed:** set `STORAGE_PROVIDER`, upload file, read public URL, generate signed URL, delete file.

### 5.6 Mobile/EAS is configured but not built here

Mobile app white-label values can be generated, but actual EAS builds require Expo credentials and network access.

**Fix/check needed:** run EAS iOS/Android build using generated values and test on real devices.

### 5.7 DNS/SSL cannot be fully verified in sandbox

The platform can show DNS instructions and resolve tenant by domain, but real SSL requires production domain and hosting/load balancer.

**Fix/check needed:** add CNAME/A/ALIAS record, wait propagation, verify SSL certificate.

### 5.8 Full runtime build was blocked by install issue

Dependency install in this sandbox did not complete, so production build/test cannot be honestly marked as passed here.

**Fix/check needed:** run install/build/test in local or server environment with network access.

## 6. How the system works end-to-end

### Tenant onboarding flow

1. Consultant/business opens global marketplace onboarding.
2. They submit name, slug, category, contact and branding details.
3. Backend creates tenant record.
4. Platform/admin approves/configures tenant.
5. Tenant receives dedicated portal by slug/custom domain.
6. Tenant admin logs in and configures branding, catalog and mobile app values.

### Customer buying flow

1. Customer browses global marketplace or tenant portal.
2. Customer selects course/book/package.
3. Checkout chooses enabled payment provider.
4. Payment gateway or bank transfer creates payment record.
5. Webhook/manual approval activates purchase/access.
6. Customer uses web/mobile app to consume content.

### Audit/logging flow

1. User performs mutation: create/update/delete.
2. Backend audit interceptor captures request/result.
3. Log is stored with user/tenant/action/entity metadata.
4. Admin can filter/export logs.
5. Retention service removes older logs after configured retention period.

### White-label flow

1. Tenant admin opens Branding page.
2. Tenant sets logo, colors, favicon, support email, tagline, domain.
3. Tenant portal loads branding from tenant context.
4. Mobile App page generates EAS env values.
5. Platform/operator runs EAS build for tenant app.

### Multi-role flow

1. Platform admin opens Team page.
2. Admin assigns tenant roles to user.
3. Auth response includes tenantRoles.
4. Frontend role switcher allows only assigned roles.
5. User switches between tenant admin and consultant modes.

## 7. Environment variables checklist

### Required core

```bash
DATABASE_URL=
JWT_SECRET=
PUBLIC_API_URL=
PUBLIC_WEB_URL=
PUBLIC_MARKETPLACE_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_ROOT_DOMAIN=
```

### Payments

```bash
PAYMENT_PROVIDERS=gopayfast,bank_transfer
GOPAYFAST_MODE=sandbox
GOPAYFAST_SANDBOX_MERCHANT_ID=
GOPAYFAST_SANDBOX_SECURED_KEY=
GOPAYFAST_LIVE_MERCHANT_ID=
GOPAYFAST_LIVE_SECURED_KEY=
GOPAYFAST_MERCHANT_NAME=
```

### Email

```bash
SENDGRID_API_KEY=
MAIL_FROM=
# Or implement real SMTP first, then use:
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

### LeadConnector / GHL

```bash
LEADCONNECTOR_CLIENT_ID=
LEADCONNECTOR_CLIENT_SECRET=
```

### Storage

```bash
STORAGE_PROVIDER=s3 # or r2, bunny, supabase
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

### Domains

```bash
PLATFORM_CNAME_TARGET=cname.your-platform-domain.com
ROOT_DOMAIN=your-platform-domain.com
```

### Audit logs

```bash
AUDIT_LOG_RETENTION_DAYS=30
AUDIT_RETENTION_SWEEP_HOURS=24
```

### Mobile / EAS

Generated from `/tenant-admin/mobile-app`:

```bash
EXPO_PUBLIC_APP_NAME=
EXPO_PUBLIC_APP_SLUG=
EXPO_PUBLIC_BUNDLE_ID=
EXPO_PUBLIC_ANDROID_PKG=
EXPO_PUBLIC_TENANT_SLUG=
EXPO_PUBLIC_BRAND_COLOR=
WHITE_LABEL_ICON_URL=
WHITE_LABEL_SPLASH_URL=
EAS_PROJECT_ID=
```

## 8. Final handoff checklist

Before giving to a client or launching production:

1. Run backend install/build/test.
2. Run Prisma generate and migrations.
3. Run web build.
4. Run marketplace build.
5. Select and test one real storage provider.
6. Configure and test SendGrid or implement real SMTP.
7. Configure and test GoPayFast sandbox payment.
8. Configure and test LeadConnector OAuth if GHL is required.
9. Configure DNS/CNAME and verify SSL.
10. Run one tenant onboarding from marketplace.
11. Approve/configure tenant.
12. Login as tenant admin and set branding.
13. Create course/book/package from tenant admin.
14. Confirm marketplace catalog shows tenant/global content correctly.
15. Confirm tenant portal shows only tenant-scoped content.
16. Run a purchase and confirm access activation.
17. Confirm audit log captures the actions.
18. Generate mobile app env values and run EAS build.
19. Test mobile app login, push token, content access and branding.
20. Export audit report and reconciliation report.

## 9. Final conclusion

The platform has a strong enterprise-level foundation and most integrations are structurally connected. The main remaining risk is not missing screens/code, but **production credential validation**:

- Real payment gateway test.
- Real email provider test.
- Real LeadConnector OAuth test.
- Real storage provider test.
- Real DNS/SSL test.
- Real EAS mobile builds.
- Full install/build/test in a network-enabled environment.

For a non-deep-technical reviewer, the platform can be described as:

> A white-label multi-tenant marketplace platform where the main marketplace onboards consultants/businesses, each approved tenant gets their own branded portal and mobile app configuration, admins can manage users/roles/logs/revenue, tenants can manage their own catalog and branding, customers can buy courses/books/packages, and backend audit logs track platform activity.
