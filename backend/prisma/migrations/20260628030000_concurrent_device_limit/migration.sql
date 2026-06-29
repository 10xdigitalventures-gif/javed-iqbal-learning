-- User: per-user concurrent device limit
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "maxDevices" INTEGER NOT NULL DEFAULT 2;

-- Logged-in devices / sessions
CREATE TABLE IF NOT EXISTS "UserDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "label" TEXT,
  "platform" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");
CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId");

DO $$ BEGIN
  ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
