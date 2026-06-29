-- Add Urdu/bilingual fields to Book
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "titleUrdu" TEXT;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "descriptionUrdu" TEXT;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "contentKeyUrdu" TEXT;

-- Add Urdu fields + free-preview flag to Chapter
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "titleUrdu" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "contentKeyUrdu" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "isFree" BOOLEAN NOT NULL DEFAULT false;
