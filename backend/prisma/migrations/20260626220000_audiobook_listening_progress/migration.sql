-- Phase 9: audiobook listening-progress persistence
-- Persist audio resume state on the existing ReadingProgress row so listeners
-- can pick up exactly where they left off (chapter + position + duration).

ALTER TABLE "ReadingProgress" ADD COLUMN IF NOT EXISTS "lastAudioChapterId" TEXT;
ALTER TABLE "ReadingProgress" ADD COLUMN IF NOT EXISTS "audioPositionSec" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReadingProgress" ADD COLUMN IF NOT EXISTS "audioDurationSec" INTEGER;
