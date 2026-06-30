-- User segmentation tags (used to target admin push notifications)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
