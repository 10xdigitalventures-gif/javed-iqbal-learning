-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referredByCode" TEXT;

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleAttribution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "buyerUserId" TEXT NOT NULL,
    "referralCodeId" TEXT,
    "referrerUserId" TEXT,
    "assistedById" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'DIRECT',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "landingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "attributionId" TEXT,
    "referralCodeId" TEXT,
    "paymentId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_tenantId_idx" ON "ReferralCode"("tenantId");

-- CreateIndex
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleAttribution_paymentId_key" ON "SaleAttribution"("paymentId");

-- CreateIndex
CREATE INDEX "SaleAttribution_tenantId_idx" ON "SaleAttribution"("tenantId");

-- CreateIndex
CREATE INDEX "SaleAttribution_referrerUserId_idx" ON "SaleAttribution"("referrerUserId");

-- CreateIndex
CREATE INDEX "SaleAttribution_buyerUserId_idx" ON "SaleAttribution"("buyerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_attributionId_key" ON "Commission"("attributionId");

-- CreateIndex
CREATE INDEX "Commission_tenantId_idx" ON "Commission"("tenantId");

-- CreateIndex
CREATE INDEX "Commission_beneficiaryId_idx" ON "Commission"("beneficiaryId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAttribution" ADD CONSTRAINT "SaleAttribution_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAttribution" ADD CONSTRAINT "SaleAttribution_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAttribution" ADD CONSTRAINT "SaleAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "SaleAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
