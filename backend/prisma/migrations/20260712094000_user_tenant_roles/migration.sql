CREATE TABLE IF NOT EXISTS "UserTenantRole" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserTenantRole_userId_tenantId_role_key" ON "UserTenantRole"("userId", "tenantId", "role");
CREATE INDEX IF NOT EXISTS "UserTenantRole_userId_idx" ON "UserTenantRole"("userId");
CREATE INDEX IF NOT EXISTS "UserTenantRole_tenantId_idx" ON "UserTenantRole"("tenantId");
