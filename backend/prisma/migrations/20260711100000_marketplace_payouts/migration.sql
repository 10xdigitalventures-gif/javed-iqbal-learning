-- Phase A: Marketplace multi-tenant — payouts, per-tenant platform fee,
-- dedicated-portal flag, and the tenant-admin role.

-- 1. New role for the dedicated (short) admin panel.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TENANT_ADMIN';

-- 2. Payout status enum.
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Tenant: per-tenant platform fee % (default 15) + dedicated-portal flag.
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "hasDedicatedPortal" BOOLEAN NOT NULL DEFAULT false;

-- 4. Payout: one earnings record per completed sale (owner net + platform fee).
CREATE TABLE IF NOT EXISTS "Payout" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "ownerUserId" TEXT,
  "paymentId"   TEXT,
  "orderId"     TEXT,
  "purchaseId"  TEXT,
  "productKind" TEXT NOT NULL,
  "productId"   TEXT,
  "productName" TEXT,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "feePercent"  DOUBLE PRECISION NOT NULL,
  "platformFee" DOUBLE PRECISION NOT NULL,
  "netAmount"   DOUBLE PRECISION NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'PKR',
  "status"      "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payout_tenantId_idx"    ON "Payout"("tenantId");
CREATE INDEX IF NOT EXISTS "Payout_ownerUserId_idx" ON "Payout"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx"      ON "Payout"("status");
CREATE INDEX IF NOT EXISTS "Payout_createdAt_idx"   ON "Payout"("createdAt");

-- FKs (best-effort; skipped if they already exist).
DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
