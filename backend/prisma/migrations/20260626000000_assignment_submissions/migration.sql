-- =============================================================================
-- Assignment lessons + submission review flow
-- Adds: SubmissionStatus enum, Assignment.lessonId / attachments,
--       AssignmentSubmission.answerText / attachments / status / reviewedAt.
-- Safe to run on an existing database (additive, idempotent guards).
-- =============================================================================

-- Submission review status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubmissionStatus') THEN
    CREATE TYPE "SubmissionStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- Assignment: link to a lesson + instructor reference attachments
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "lessonId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "attachments" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'Assignment_lessonId_key'
  ) THEN
    CREATE UNIQUE INDEX "Assignment_lessonId_key" ON "Assignment"("lessonId");
  END IF;
END $$;

-- AssignmentSubmission: typed answer, file attachments, review status
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "answerText" TEXT;
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "attachments" TEXT;
ALTER TABLE "AssignmentSubmission"
  ADD COLUMN IF NOT EXISTS "status" "SubmissionStatus" NOT NULL DEFAULT 'UNDER_REVIEW';
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- Existing graded rows should reflect an APPROVED state.
UPDATE "AssignmentSubmission"
  SET "status" = 'APPROVED', "reviewedAt" = COALESCE("reviewedAt", "submittedAt")
  WHERE "grade" IS NOT NULL;
