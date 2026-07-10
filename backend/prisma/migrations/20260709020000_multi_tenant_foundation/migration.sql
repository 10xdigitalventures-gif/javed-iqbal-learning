-- Multi-tenancy foundation (backward compatible).
-- Creates the Tenant table, seeds one default tenant (Dr. Javed Iqbal),
-- adds a nullable tenantId to core models and backfills every existing row
-- to the default tenant so all current data and flows keep working.

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customDomain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "fontFamily" TEXT,
    "tagline" TEXT,
    "supportEmail" TEXT,
    "moduleFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");
CREATE INDEX "Tenant_customDomain_idx" ON "Tenant"("customDomain");

-- Seed the default tenant with the current Dr. Javed branding.
INSERT INTO "Tenant" ("id","slug","name","isActive","isDefault","brandName","primaryColor","createdAt","updatedAt")
VALUES ('tenant_default_javed','drjaved','Dr. Javed Iqbal',true,true,'Dr. Javed Iqbal','#FF9100',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Core models: nullable tenantId + backfill to default + index.
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
UPDATE "User" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

ALTER TABLE "Package" ADD COLUMN "tenantId" TEXT;
UPDATE "Package" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Package_tenantId_idx" ON "Package"("tenantId");

ALTER TABLE "Book" ADD COLUMN "tenantId" TEXT;
UPDATE "Book" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Book_tenantId_idx" ON "Book"("tenantId");

ALTER TABLE "Course" ADD COLUMN "tenantId" TEXT;
UPDATE "Course" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Course_tenantId_idx" ON "Course"("tenantId");

ALTER TABLE "Community" ADD COLUMN "tenantId" TEXT;
UPDATE "Community" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Community_tenantId_idx" ON "Community"("tenantId");

ALTER TABLE "Bundle" ADD COLUMN "tenantId" TEXT;
UPDATE "Bundle" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Bundle_tenantId_idx" ON "Bundle"("tenantId");

ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
UPDATE "Order" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
UPDATE "Payment" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

ALTER TABLE "Subscription" ADD COLUMN "tenantId" TEXT;
UPDATE "Subscription" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

ALTER TABLE "SubscriptionPlan" ADD COLUMN "tenantId" TEXT;
UPDATE "SubscriptionPlan" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "SubscriptionPlan_tenantId_idx" ON "SubscriptionPlan"("tenantId");

ALTER TABLE "Purchase" ADD COLUMN "tenantId" TEXT;
UPDATE "Purchase" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Purchase_tenantId_idx" ON "Purchase"("tenantId");

ALTER TABLE "HardCopyOrder" ADD COLUMN "tenantId" TEXT;
UPDATE "HardCopyOrder" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "HardCopyOrder_tenantId_idx" ON "HardCopyOrder"("tenantId");

ALTER TABLE "Coupon" ADD COLUMN "tenantId" TEXT;
UPDATE "Coupon" SET "tenantId" = 'tenant_default_javed' WHERE "tenantId" IS NULL;
CREATE INDEX "Coupon_tenantId_idx" ON "Coupon"("tenantId");

