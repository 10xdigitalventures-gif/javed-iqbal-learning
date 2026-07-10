# Custom Domain Setup (White-Label)

Every tenant gets a free subdomain at `<slug>.10xdigitalventures.com` out of the box.
This guide explains how to point a **custom vanity domain** (e.g. `learn.drjaved.com`) to
the tenant's storefront.

## 1. Tenant requests a custom domain

The tenant (or admin) calls:

```
GET /api/tenant/public/verify-domain?domain=learn.drjaved.com
```

Response includes DNS setup instructions:

```json
{
  "domain": "learn.drjaved.com",
  "claimed": false,
  "dns": {
    "type": "CNAME",
    "name": "learn.drjaved.com",
    "value": "cname.10xdigitalventures.com",
    "ttl": 3600
  },
  "instructions": [
    "1. Add a CNAME record ...",
    "2. Wait for DNS propagation ...",
    "3. Ask an admin to set customDomain via PATCH /api/tenant/:id",
    "4. Platform auto-provisions SSL once CNAME resolves."
  ]
}
```

## 2. DNS configuration

In the tenant's DNS provider (Cloudflare, GoDaddy, Route53, etc.):

| Type  | Name                  | Value                              | TTL  |
|-------|-----------------------|------------------------------------|------|
| CNAME | `learn.drjaved.com`   | `cname.10xdigitalventures.com`     | 3600 |

> **Apex domains** (e.g. `drjaved.com` without a subdomain) cannot use CNAME.
> Use an **ALIAS** or **ANAME** record if your DNS provider supports it,
> or use a `www` subdomain instead.

## 3. Admin activates the domain

Once DNS propagates (verify with `dig CNAME learn.drjaved.com`), an admin sets the
`customDomain` field on the tenant:

```bash
curl -X PATCH https://api.10xdigitalventures.com/api/tenant/<tenantId> \
  -H 'Authorization: Bearer <admin-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"customDomain": "learn.drjaved.com"}'
```

## 4. SSL / TLS

Configure your reverse proxy (Caddy, Nginx + Certbot, Vercel, or Cloudflare) to:

- Terminate TLS for the custom domain.
- Proxy requests to the **frontend** (Next.js web app) or **marketplace** app.
- Forward the `Host` header so the backend tenant middleware can resolve correctly.

### Caddy example

```caddy
learn.drjaved.com {
  reverse_proxy app:3000
}
```

### Nginx example

```nginx
server {
  listen 443 ssl;
  server_name learn.drjaved.com;
  # ... ssl_certificate config ...
  location / {
    proxy_pass http://web-app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
  }
}
```

## 5. How tenant resolution works

The backend `TenantContextMiddleware` resolves tenants in this order:

1. `x-tenant-id` request header (internal/admin override)
2. `x-tenant` request header (alias)
3. `customDomain` exact match in DB (e.g. `learn.drjaved.com`)
4. Subdomain of `PLATFORM_ROOT_DOMAIN` (e.g. `drjaved.10xdigitalventures.com`)
5. Falls back to the default tenant

So custom domains work automatically once the `customDomain` field is set in the DB.

## 6. Environment variables

```env
# Target for CNAME records (set to your load-balancer or Cloudflare proxy).
PLATFORM_CNAME_TARGET=cname.10xdigitalventures.com

# The root domain tenants get free subdomains under.
PLATFORM_ROOT_DOMAIN=10xdigitalventures.com
```
