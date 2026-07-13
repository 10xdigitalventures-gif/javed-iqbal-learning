-- Full audit log fields for enterprise tracking
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entity" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "before" JSONB;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "after" JSONB;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "ActivityLog_tenantId_idx" ON "ActivityLog"("tenantId");
CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
