-- Book a Chat: dynamic per-message limits, consultation mode (both models),
-- and consultation status workflow.

-- New enums
CREATE TYPE "ConsultationMode" AS ENUM ('CHAT', 'SINGLE');
CREATE TYPE "ConsultationStatus" AS ENUM ('ACTIVE', 'WAITING_SUBMISSION', 'MESSAGE_SUBMITTED', 'UNDER_REVIEW', 'RESPONSE_SENT', 'CLOSED');

-- Package: word limit + consultation mode
ALTER TABLE "Package" ADD COLUMN "textWordLimit" INTEGER;
ALTER TABLE "Package" ADD COLUMN "consultationMode" "ConsultationMode" NOT NULL DEFAULT 'CHAT';

-- Purchase: snapshot of word limit + mode
ALTER TABLE "Purchase" ADD COLUMN "textWordLimit" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN "consultationMode" "ConsultationMode" NOT NULL DEFAULT 'CHAT';

-- Conversation: link to purchase + lifecycle status
ALTER TABLE "Conversation" ADD COLUMN "purchaseId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "status" "ConsultationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
