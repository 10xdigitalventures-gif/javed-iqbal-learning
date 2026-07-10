-- Performance: add missing indexes on high-traffic models.
-- These support common query patterns: user-scoped lookups, status filtering,
-- and the report time-series (status+createdAt compound on Payment).

-- User: role-based listing (admin clients/consultants queries)
CREATE INDEX "User_role_idx" ON "User"("role");

-- Payment: per-user history + status filtering + timeseries reports
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- Purchase: client/consultant purchase lookups + status filtering
CREATE INDEX "Purchase_clientId_idx" ON "Purchase"("clientId");
CREATE INDEX "Purchase_consultantId_idx" ON "Purchase"("consultantId");
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- Meeting: consultant/client meeting lists + status filtering (no indexes existed)
CREATE INDEX "Meeting_consultantId_idx" ON "Meeting"("consultantId");
CREATE INDEX "Meeting_clientId_idx" ON "Meeting"("clientId");
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- Order: per-user order history + status filtering
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- Notification: per-user notification feed
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- Message: conversation thread + sender queries
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
