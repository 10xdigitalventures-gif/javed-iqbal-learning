# Production Domain Setup (No localhost)

The platform runs entirely on your real domains. There is **no localhost**
anywhere in the production config.

## Domains

| Purpose        | Domain                              |
|----------------|-------------------------------------|
| Web app        | `app.mentoringhub.online`           |
| API (backend)  | `api.mentoringhub.online`           |
| Marketplace    | `marketplace.mentoringhub.online`   |
| Tenant sites   | `<slug>.mentoringhub.online`        |

## 1. DNS records

Create these at your DNS provider, pointing to the **public IP** of the
server(s) where each app is deployed.

| Type | Name (host)   | Value                       | Notes                     |
|------|---------------|-----------------------------|---------------------------|
| A    | `app`         | `<WEB_SERVER_PUBLIC_IP>`    | primary web app           |
| A    | `api`         | `<API_SERVER_PUBLIC_IP>`    | backend API               |
| A    | `marketplace` | `<WEB_SERVER_PUBLIC_IP>`    | marketplace app           |
| A    | `*`           | `<WEB_SERVER_PUBLIC_IP>`    | tenant subdomains (wildcard) |

> If everything runs on ONE server, use the same IP for all rows.

### A record vs Cloudflare

- **A record** maps a subdomain directly to a server IP.
- **Cloudflare proxy (orange cloud)** sits in front, terminates SSL, forwards to
  your origin. You do NOT have to remove it.
  - Keep it proxied and set Cloudflare SSL mode to **Full (strict)** (valid
    origin cert) or **Full** (self-signed origin). Do **not** use **Flexible**
    — it breaks secure cookies / login with redirect loops.
  - Or set **DNS only (grey cloud)** and install SSL on the server yourself
    (Let's Encrypt / Caddy / Nginx).
- Login uses a **secure cookie**, so every domain MUST be served over **HTTPS**.

## 2. Backend env (server)

Copy `backend/.env.production.example` to `backend/.env` and fill secrets.
Already set for you:

```
NODE_ENV=production
PUBLIC_WEB_URL=https://app.mentoringhub.online
PUBLIC_API_URL=https://api.mentoringhub.online/api
PLATFORM_ROOT_DOMAIN=mentoringhub.online
AUTH_COOKIE_DOMAIN=.mentoringhub.online
CORS_ALLOWED_ORIGINS=https://app.mentoringhub.online,https://marketplace.mentoringhub.online
ENABLE_MOCK_PAYMENTS=false
```

Still fill: `DATABASE_URL`, `JWT_SECRET`, `MEDIA_SIGNING_SECRET`, storage/S3 and
payment/email provider secrets.

## 3. Web + Marketplace env (already set, no localhost)

- `web/.env.production` -> `NEXT_PUBLIC_API_URL=https://api.mentoringhub.online/api`
- `marketplace/.env.production` -> API + `NEXT_PUBLIC_ROOT_DOMAIN=mentoringhub.online`

Next.js loads `.env.production` automatically during `npm run build`.

## 4. Mobile app

`mobile/.env` and `mobile/eas.json` already target
`https://api.mentoringhub.online/api` — no change needed.

## 5. Deploy order

1. Point DNS (section 1); confirm `api.mentoringhub.online` resolves + HTTPS.
2. Deploy backend with `backend/.env` (section 2).
3. `cd web && npm run build` then start it on `app.mentoringhub.online`.
4. `cd marketplace && npm run build` then start it on `marketplace.mentoringhub.online`.
5. Test login on phone (secure cookie needs HTTPS end to end).

## 6. Why login failed on the phone before

The web app had been built with `NEXT_PUBLIC_API_URL=http://localhost:4000/api`,
so on a phone "localhost" meant the phone itself. Now it points at
`https://api.mentoringhub.online/api`, reachable from any device. The shared
cookie domain `.mentoringhub.online` lets the auth cookie work across
app./api./marketplace. subdomains.
