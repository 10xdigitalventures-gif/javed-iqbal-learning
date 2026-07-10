# Horizontal Scaling Guide

The 10X Platform API is designed to be stateless and horizontally scalable.
This guide documents the current architecture and what to configure for
multi-instance deployments.

## Architecture overview

| Concern | Current | Horizontally-scalable |
|---|---|---|
| **Auth** | JWT (stateless) ✅ | No change needed |
| **File storage** | Local disk (default) | Set `STORAGE_DRIVER=s3` ✅ |
| **Rate limiting** | In-process (per-instance) | Add Redis store (see below) |
| **Realtime / push** | HTTP long-poll + Expo Push | No shared state needed ✅ |
| **Scheduled jobs** | None currently | — |
| **DB** | Single PostgreSQL | Add read-replica + connection pooler (PgBouncer/Neon) |
| **Media signing** | `MEDIA_SIGNING_SECRET` (stateless HMAC) ✅ | No change needed |

## Recommended production setup

### 1. Use S3-compatible object storage

```env
STORAGE_DRIVER=s3
S3_BUCKET=10x-platform-media
S3_REGION=ap-south-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# For Cloudflare R2:
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_PUBLIC_URL=https://media.10xdigitalventures.com
```

### 2. Configure Redis for shared rate limiting

Install the Redis throttler store:

```bash
npm install @nestjs-modules/ioredis ioredis
npm install @nestjs/throttler-storage-redis
```

Update `app.module.ts`:

```ts
import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';
// In ThrottlerModule.forRoot:
ThrottlerModule.forRootAsync({
  useFactory: () => ({
    throttlers: [{ ttl: +process.env.RATE_LIMIT_TTL_SEC, limit: +process.env.RATE_LIMIT_MAX }],
    storage: process.env.REDIS_URL
      ? new ThrottlerStorageRedisService(process.env.REDIS_URL)
      : undefined,
  }),
})
```

```env
REDIS_URL=redis://localhost:6379
```

### 3. Run multiple API instances behind a load balancer

```yaml
# docker-compose example
services:
  api:
    image: 10x-platform-api
    replicas: 3
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      STORAGE_DRIVER: s3
    depends_on: [postgres, redis]
  nginx:
    image: nginx
    # round-robin upstream to api:4000
```

### 4. Database connection pooling

For many API instances hitting one Postgres:

```bash
# Use PgBouncer in transaction mode, or Neon serverless pooling:
DATABASE_URL=postgresql://user:pass@pgbouncer:5432/consult_hub?pgbouncer=true
```

### 5. CDN for public marketplace API responses

The public tenant endpoints (`/api/tenant/directory`, `/api/tenant/public/:slug`,
`/api/tenant/public/:slug/catalog`) already return `Cache-Control: public, max-age=60, s-maxage=300`.

Put Cloudflare or a Vercel Edge Cache in front of `api.10xdigitalventures.com` to
cache these globally with zero backend load for most marketplace visitors.

## Database indexes (already applied)

Migration `20260709070000_missing_indexes` adds 14 indexes across high-traffic models:

- **User**: `role`
- **Payment**: `userId`, `status`, `(status, createdAt)` compound
- **Purchase**: `clientId`, `consultantId`, `status`
- **Meeting**: `consultantId`, `clientId`, `status`
- **Order**: `userId`, `status`
- **Notification**: `userId`, `read`
- **Message**: `conversationId`, `senderId`

## Checklist before going live

- [ ] `JWT_SECRET` — strong random secret (never use default)
- [ ] `MEDIA_SIGNING_SECRET` — strong random secret
- [ ] `STORAGE_DRIVER=s3` + all S3 vars
- [ ] `REDIS_URL` — for multi-instance rate limiting
- [ ] `DATABASE_URL` — production Postgres with SSL
- [ ] `PLATFORM_ROOT_DOMAIN=10xdigitalventures.com`
- [ ] `PUBLIC_API_URL=https://api.10xdigitalventures.com/api`
- [ ] `PUBLIC_WEB_URL=https://app.profdrjaved.com`
- [ ] `GHL_SYNC_ENABLED=true` + all GHL vars
- [ ] Run `npx prisma migrate deploy` before first boot
- [ ] S3 bucket CORS policy allows presigned URL origins
