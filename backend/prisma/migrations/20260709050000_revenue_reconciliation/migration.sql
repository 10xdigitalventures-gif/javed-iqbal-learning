-- CreateTable
CREATE TABLE "ExternalRevenue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'GHL',
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClose" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "period" TEXT NOT NULL,
    "appRevenue" DOUBLE PRECISION NOT NULL,
    "externalRevenue" DOUBLE PRECISION NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "commissionTotal" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "breakdown" JSONB,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalRevenue_tenantId_idx" ON "ExternalRevenue"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalRevenue_period_idx" ON "ExternalRevenue"("period");

-- CreateIndex
CREATE INDEX "MonthlyClose_tenantId_idx" ON "MonthlyClose"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClose_tenantId_period_key" ON "MonthlyClose"("tenantId", "period");
