-- Dunning / retry state for auto-renewing subscriptions
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "renewAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "graceUntil" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pendingOrderId" TEXT;
