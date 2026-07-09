-- Per-user permission scopes (for SUPPORT staff) + support ticket assignment.
ALTER TABLE "User" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SupportTicket" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "assignedAt" TIMESTAMP(3);

CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
