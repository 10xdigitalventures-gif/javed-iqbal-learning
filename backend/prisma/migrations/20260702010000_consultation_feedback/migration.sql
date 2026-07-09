-- Book a Chat: client feedback (rating + comment) captured when a single
-- consultation auto-closes after the client reads the consultant's response.
ALTER TABLE "Conversation" ADD COLUMN "feedbackRating" INTEGER;
ALTER TABLE "Conversation" ADD COLUMN "feedbackComment" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "feedbackAt" TIMESTAMP(3);
