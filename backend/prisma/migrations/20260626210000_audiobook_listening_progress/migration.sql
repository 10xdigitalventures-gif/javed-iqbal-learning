-- Phase 9: audiobook listening-progress persistence
-- Adds playback resume state to the per-(user, book) reading progress row so
-- audiobooks can resume from where the listener left off.

ALTER TABLE "ReadingProgress" ADD COLUMN IF NOT EXISTS "lastAudioChapterId" TEXT;
ALTER TABLE "ReadingProgress" ADD COLUMN IF NOT EXISTS "lastAudioPositionSec" INTEGER NOT NULL DEFAULT 0;
