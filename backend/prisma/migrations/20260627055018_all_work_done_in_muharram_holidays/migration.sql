/*
  Warnings:

  - You are about to drop the column `lastAudioPositionSec` on the `ReadingProgress` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LessonSource" AS ENUM ('UPLOAD', 'LINK', 'MEDIA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LearningProductKind" ADD VALUE 'COURSE';
ALTER TYPE "LearningProductKind" ADD VALUE 'COMMUNITY';

-- DropForeignKey
ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_userId_fkey";

-- DropIndex
DROP INDEX "CourseReview_courseId_idx";

-- DropIndex
DROP INDEX "LessonAnswer_questionId_idx";

-- DropIndex
DROP INDEX "LessonNote_userId_lessonId_idx";

-- DropIndex
DROP INDEX "LessonQuestion_lessonId_idx";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "source" "LessonSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "communityId" TEXT,
ADD COLUMN     "courseId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "manualNote" TEXT,
ADD COLUMN     "proofKey" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderRef" TEXT;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "answers" TEXT;

-- AlterTable
ALTER TABLE "ReadingProgress" DROP COLUMN "lastAudioPositionSec";

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "storage" TEXT NOT NULL DEFAULT 'cloud',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
