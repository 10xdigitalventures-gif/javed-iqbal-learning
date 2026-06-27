-- Quiz enhancements: timer, attempt limit, shuffle, weighted + typed questions.

-- New question-type enum.
DO $$ BEGIN
  CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE', 'MULTI', 'TRUE_FALSE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Quiz-level settings.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "timeLimitSec" INTEGER;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "shuffle" BOOLEAN NOT NULL DEFAULT false;

-- Question-level settings.
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "type" "QuizQuestionType" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "QuizQuestion" ADD COLUMN IF NOT EXISTS "correct" TEXT;

-- Attempt timing.
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "timeTakenSec" INTEGER;
