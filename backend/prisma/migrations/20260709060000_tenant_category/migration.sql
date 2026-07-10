-- AlterTable: add category to Tenant for marketplace discovery/filtering
ALTER TABLE "Tenant" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "Tenant_category_idx" ON "Tenant"("category");
