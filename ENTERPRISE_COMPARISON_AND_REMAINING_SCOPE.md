# Enterprise comparison + remaining scope audit

## Current status

### Completed / already present

- Single backend + shared database with tenant isolation via `tenantId`.
- Global marketplace app with expert directory, global courses/books/packages catalog, and marketplace-only onboarding.
- Dedicated tenant portal foundation using host/header tenant resolution, custom domain/subdomain support, branding fields, feature flags, and per-tenant platform fee.
- Phase F started: dedicated portal is scoped/branded and does **not** contain direct onboarding.
- Phase G started: `TENANT_ADMIN` role, short tenant admin routes, tenant-scoped revenue via `/payouts/me`, role switcher UI, tenant-admin pages for packages/courses/e-books/revenue.
- Main admin tenant feature screen includes platform fee %, module flags, and dedicated portal toggle.
- Existing admin audit log screen/API and CSV export are present.
- Payment provider abstraction exists for GoPayFast, Whop, and mock checkout.
- Activity logging exists for key events and admin audit export.

## Important issues found during code/text review

### 1. Dependency/test environment

- The extracted ZIP has no `node_modules`, so `next build`, Nest build, Prisma generate, and real typecheck cannot complete here.
- A raw TypeScript command fails mostly because dependencies and Prisma client are not installed/generated.
- Required local/deploy check remains:
  - `cd backend && npm install && npx prisma generate && npm run build && npm run test:e2e`
  - `cd web && npm install && npm run build`
  - `cd marketplace && npm install && npm run build`

### 2. Documentation drift

- Older docs still describe the project as only `backend/web/mobile`; they do not fully document `marketplace`, `mobile-marketplace`, dedicated tenant admin, dual presence, tenant feature scope, or Phase F/G status.
- Marketplace README still says `/` fetches `GET /tenant/directory`, but current code uses `GET /marketplace/catalog`.
- Some docs still refer to PayFast while current provider work includes GoPayFast/Whop/mock.

### 3. UX/text cleanup

- Marketplace onboarding text is correctly only in the marketplace app (`/onboard`, “Become an expert”). No dedicated tenant portal onboarding route was found in `web/src/app`.
- Existing chat reactions use emoji as message reactions. This is content/functionality, not UI navigation iconography. For design-system rule compliance, navigation/action icons should stay Lucide/SVG.
- Dedicated tenant admin text is clear but still basic; production copy should explain scope: “You can manage only this tenant’s content and payouts.”

### 4. Tenant admin work still needs hardening

- Tenant-admin content pages were bootstrapped from main admin pages. They need a full UI pass to remove any global-admin wording, filters, or actions not allowed for tenants.
- Tenant-admin backend routes need real build validation after dependencies are installed.
- Tenant-admin book chapter/media import subroutes still need tenant-scoped versions or explicit blocking if not allowed.
- Role switcher currently links between admin and consultant views based on current role; true “same email/user has both features” may require account model support for multiple roles or a secondary role/permission field. Current schema has single `User.role`.

## Enterprise benchmark comparison

| Capability                | Enterprise expectation                                             | Current platform                                                       | Gap / action                                                                                            |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Multi-tenant isolation    | Strict tenant data separation, no cross-tenant access              | `tenantId` exists across many models; tenant context middleware exists | Add automated tests for tenant isolation on every admin/tenant endpoint                                 |
| Global super admin        | Platform owner can manage all tenants, users, features, revenue    | Main admin exists with tenant feature screen and revenue               | Add tenant-level dashboard summary and tenant health metrics                                            |
| Dedicated tenant admin    | Tenant admin manages only own content/settings                     | Started with `/tenant-admin` pages and tenant-scoped routes            | Finish UI, permissions, tests, chapter/media subroutes                                                  |
| Marketplace dual presence | Dedicated tenants also visible in global marketplace               | Implemented in marketplace catalog/listed tenants                      | Add filters, search, categories, sorting, featured tenants                                              |
| Onboarding model          | Central approval flow; no onboarding on tenant portal              | Marketplace-only onboarding; tenants unlisted until approval           | Add approval checklist/status history and admin notifications                                           |
| White-label branding      | Logo, colors, fonts, custom domain, favicon, email/report branding | Branding fields + custom domain docs exist                             | Add email template branding, PDF/report branding, per-tenant SEO metadata                               |
| Feature flags             | Per-tenant module toggles                                          | Module flags exist for books/courses/chat/live sessions etc.           | Add audit trail for feature flag changes + preview as tenant                                            |
| Revenue/payouts           | Gross, fees, net payout, status, exports                           | Payout model and summary exist                                         | Add payout status workflow, export, invoices, reconciliation by tenant                                  |
| Audit logs                | “Who did what, where, when”, immutable, filterable, exportable     | Activity log + admin audit page + CSV export exist                     | Expand event coverage to all admin/tenant mutations, add before/after JSON, IP/device, retention policy |
| Compliance                | Privacy, backups, rate limits, secure headers                      | Privacy page, helmet, throttling, deployment notes                     | Add 2FA, SSO/SAML/OIDC, data retention, DPA/GDPR deletion/export workflows                              |
| Enterprise auth           | RBAC, multi-role, SSO, 2FA                                         | JWT + roles + OTP; single role per user                                | Add multi-role/role-switching model, tenant admin scopes, 2FA, optional SSO                             |
| Observability             | Logs, metrics, alerts, uptime, job monitoring                      | Basic docs mention monitoring                                          | Add structured app logs, error tracking, audit log volume by tenant                                     |
| Data exports              | Admin and tenant exports                                           | Audit CSV exists                                                       | Add revenue, orders, users, content exports per tenant                                                  |
| Domain/SSL                | Custom domains with SSL automation                                 | Custom domain docs and resolution exist                                | Add automated domain verification status in admin UI                                                    |
| Support/admin oversight   | Platform can inspect issues with permission boundaries             | Admin can audit communications by design                               | Add access reason logging when admin views private records                                              |

## High-priority remaining work

1. **Finish Phase F dedicated tenant portal frontend**
   - Tenant-scoped storefront landing page using active tenant branding.
   - Tenant catalog pages for courses/books/packages.
   - Booking/chat entry points only if feature flags allow.
   - No onboarding CTA/form on any dedicated portal page.
   - Responsive QA at 375/768/1024/1440.

2. **Finish Phase G short tenant admin + role switcher**
   - Finalize `/tenant-admin` pages and remove global-admin wording.
   - Add tenant-scoped media/chapter/course module management or disable those controls.
   - Implement true multi-role support if one user must switch between tenant admin and consultant without separate accounts.
   - Add tenant-admin permission tests.

3. **Enterprise audit log upgrade**
   - Log every create/update/delete for tenants, users, courses, books, packages, feature flags, payouts, settings, payments.
   - Store actor, role, tenantId, target type/id, action, timestamp, IP/user-agent, before/after JSON, request id.
   - Make logs append-only; restrict deletion; add retention/archive policy.
   - Add filters: tenant, actor, action, entity, date range, severity.
   - Add tenant-level audit view (tenant admins see only own tenant).

4. **Docs alignment**
   - Update README, ARCHITECTURE, DEPLOYMENT, marketplace README, and project review notes with current marketplace + tenant-admin scope.
   - Keep locked spec synced with actual implementation status.

5. **Build/test pass in connected environment**
   - Install deps, generate Prisma client, run migrations, run backend/web/marketplace builds, run E2E tests.

## Recommended enterprise additions after current scope

- 2FA for admin/tenant admin accounts.
- SAML/OIDC SSO for enterprise tenants.
- Granular tenant admin scopes, e.g. content manager, finance viewer, support agent.
- Immutable audit log table with before/after snapshots.
- Admin “view as tenant” mode with strong audit logging.
- Tenant health dashboard: active users, sales, failed payments, content count, audit volume.
- Data export center: users, orders, payouts, audit logs, content inventory.
- Domain verification UI with DNS status and SSL status.
- Report/PDF/email white-label branding.
- Backup/restore and disaster recovery runbook.

## White-label self-service work started

Added tenant-admin branding self-service so an onboarded tenant can set their own white-label values instead of the platform team doing every setup manually.

### Implemented now

- New tenant admin page: `/tenant-admin/branding`.
- New tenant admin API:
  - `GET /tenant-admin/branding`
  - `PATCH /tenant-admin/branding`
- Tenant admin can update:
  - brand name
  - tagline
  - support email
  - logo URL
  - dark logo URL
  - favicon URL
  - primary color
  - secondary color
  - accent color
  - font family
  - custom domain
- Added Branding navigation item in tenant admin sidebar.
- Page includes live preview so tenant can see logo/colors before saving.
- Saved colors already feed the existing runtime branding system in `web/src/lib/branding.tsx`, so portal colors update across the tenant portal after reload.

### Still required for complete white-label rollout

- File upload picker for logo/favicon instead of URL-only fields.
- Tenant-scoped media ownership for branding assets.
- Mobile app white-label build generator / EAS profile generator per tenant.
- Tenant app asset pack export: icon, splash, adaptive icon, app name, bundle id, tenant slug, brand color.
- Domain verification UI showing DNS/SSL status.
- White-label email templates and report/PDF branding.
- Audit logs for every branding change with before/after JSON.

## Completion pass update

The following previously identified gaps have now been addressed in code:

- Marketplace README stale `/tenant/directory` wording fixed to `/marketplace/catalog`.
- Tenant-admin course module/lesson scoped routes added with tenant ownership checks.
- Tenant-admin book content/chapter scoped routes added with tenant ownership checks.
- Tenant branding updates now write explicit before/after audit records.
- Audit retention service added to keep full logs online for at least one month and sweep older records according to environment configuration.

Remaining items are now mostly environment/runtime validation and larger product extensions: true multi-role account model, mobile app build generator, upload-based branding asset picker, DNS/SSL status UI, and white-label email/report templates.

## White-label completion pass update

The tenant-facing white-label workflow now includes domain verification and mobile app identity generation:

- `/tenant-admin/branding` can verify the configured custom domain and show CNAME instructions.
- `/tenant-admin/mobile-app` generates tenant-specific EAS environment values for branded mobile builds.
- Tenant admins can now self-configure portal branding and prepare mobile app identity values without platform staff manually writing each value.

Remaining runtime steps: run the real EAS build with these values, upload final app-store assets if needed, and validate DNS/SSL in production.
