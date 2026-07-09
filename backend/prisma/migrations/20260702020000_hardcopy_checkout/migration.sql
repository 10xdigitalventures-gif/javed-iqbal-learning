-- Hard copy 2-step checkout: delivery fields + payment link
ALTER TABLE "HardCopyOrder" ADD COLUMN "email" TEXT;
ALTER TABLE "HardCopyOrder" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "HardCopyOrder" ADD COLUMN "state" TEXT;
ALTER TABLE "HardCopyOrder" ADD COLUMN "country" TEXT;
ALTER TABLE "HardCopyOrder" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "HardCopyOrder" ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE "HardCopyOrder" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'PKR';
ALTER TABLE "Payment" ADD COLUMN "hardCopyOrderId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hardCopyOrderId_fkey" FOREIGN KEY ("hardCopyOrderId") REFERENCES "HardCopyOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
