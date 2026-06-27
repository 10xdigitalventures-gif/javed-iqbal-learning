-- Backfill the LessonCompletion table into migration history.
-- It was previously created via `prisma db push`, so it never existed as a
-- migration. IF NOT EXISTS makes this a safe no-op on databases that already
-- have the table (e.g. your live Supabase DB).
CREATE TABLE IF NOT EXISTS "LessonCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LessonCompletion_userId_lessonId_key"
    ON "LessonCompletion"("userId", "lessonId");

DO $$ BEGIN
    ALTER TABLE "LessonCompletion"
        ADD CONSTRAINT "LessonCompletion_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "LessonCompletion"
        ADD CONSTRAINT "LessonCompletion_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
