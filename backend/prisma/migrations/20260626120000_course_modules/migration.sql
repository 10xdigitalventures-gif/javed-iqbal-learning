-- Course modules (sections) + sequential/time-gated ("drip") unlocking.

-- Lock mode shared by modules and lessons.
DO $$ BEGIN
  CREATE TYPE "ModuleLockMode" AS ENUM ('SINGLE', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- New module table.
CREATE TABLE IF NOT EXISTS "CourseModule" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "lockMode" "ModuleLockMode" NOT NULL DEFAULT 'SINGLE',
  "unlockDelayHours" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseModule_courseId_index_key"
  ON "CourseModule"("courseId", "index");

DO $$ BEGIN
  ALTER TABLE "CourseModule"
    ADD CONSTRAINT "CourseModule_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Lesson grouping + per-lesson lock config.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "moduleId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "lockMode" "ModuleLockMode" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "unlockDelayHours" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "Lesson"
    ADD CONSTRAINT "Lesson_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Completion timestamp drives the time-gated unlock countdown.
ALTER TABLE "LessonCompletion" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill: treat already-completed lessons as completed at their row creation
-- time so existing learners are not retroactively re-locked.
UPDATE "LessonCompletion"
  SET "completedAt" = "createdAt"
  WHERE "completedAt" IS NULL AND "progress" >= 1;
