# 10X Marketplace

The central, platform-branded storefront where visitors discover experts
(tenants) and new experts self-onboard. It is a **separate Next.js app** from
the per-tenant web app, but talks to the **same** NestJS backend.

## Pages

- `/` — public global marketplace. Fetches `GET /marketplace/catalog` and renders listed tenants plus global courses, books, and packages. Expert cards link to `/expert/{slug}` and then onward to the tenant storefront/subdomain.
- `/onboard` — self-serve onboarding form. Checks availability via
  `GET /tenant/slug-available` and creates the tenant via `POST /tenant/onboard`.
  New tenants are provisioned on their subdomain immediately but stay UNLISTED
  until an admin approves them.

## Dual-domain model (GHL-style)

The backend `TenantContextMiddleware` resolves the active tenant per request:

1. `x-tenant-id` / `x-tenant` header (id or slug), else
2. request host — custom domain (`Tenant.customDomain`) first, then platform
   subdomain (`{slug}.10xdigitalventures.com`), else
3. the default tenant.

So a tenant runs both on the shared platform subdomain **and** on its own
custom domain (white-label), exactly like `app.gohighlevel.com` + client domains.

## Env

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_ROOT_DOMAIN=10xdigitalventures.com
```

## Run

```
npm install
npm run dev   # http://localhost:3001
```

## Current catalog behavior

The marketplace home now uses `GET /marketplace/catalog`, which returns all listed tenants plus global courses, books, and packages. Individual endpoints also exist for `/marketplace/experts`, `/marketplace/courses`, `/marketplace/books`, and `/marketplace/packages`.

Onboarding remains marketplace-only: `/onboard` calls `POST /tenant/onboard`; new tenants are created unlisted and require admin approval/configuration before public listing/dedicated portal rollout.
