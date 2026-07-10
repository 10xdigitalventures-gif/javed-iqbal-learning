-- Add a unique, trackable receipt number to payments.
-- invoiceNo already exists; receiptNo is minted the first time a payment is
-- marked PAID so every receipt can be looked up / tracked.
ALTER TABLE "Payment" ADD COLUMN "receiptNo" TEXT;
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");
