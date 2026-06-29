-- UnlockPolicy enum
DO $$ BEGIN
  CREATE TYPE "UnlockPolicy" AS ENUM ('OPEN', 'SEQUENTIAL', 'DRIP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enrollment: access window
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "accessUntil" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

-- Course: access duration + unlock policy + offline validity
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "accessDurationDays" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "unlockPolicy" "UnlockPolicy" NOT NULL DEFAULT 'SEQUENTIAL';
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "offlineValidityDays" INTEGER NOT NULL DEFAULT 30;
