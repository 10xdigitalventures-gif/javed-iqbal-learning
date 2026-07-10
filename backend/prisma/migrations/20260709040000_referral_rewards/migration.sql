-- AlterTable
ALTER TABLE "UserGameStat" ADD COLUMN "bonusPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "paymentId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referrerPoints" INTEGER NOT NULL DEFAULT 0,
    "referredPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_paymentId_key" ON "ReferralReward"("paymentId");

-- CreateIndex
CREATE INDEX "ReferralReward_tenantId_idx" ON "ReferralReward"("tenantId");

-- CreateIndex
CREATE INDEX "ReferralReward_referrerUserId_idx" ON "ReferralReward"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_referredUserId_idx" ON "ReferralReward"("referredUserId");

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
