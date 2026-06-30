CREATE TABLE IF NOT EXISTS "ScheduledNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'all',
    "tag" TEXT,
    "since" TEXT,
    "until" TEXT,
    "scheduleType" TEXT NOT NULL DEFAULT 'once',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScheduledNotification_active_nextRunAt_idx" ON "ScheduledNotification"("active", "nextRunAt");
