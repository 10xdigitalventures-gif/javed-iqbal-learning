-- Sub-modules: nested CourseModule
ALTER TABLE "CourseModule" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "CourseModule_parentId_idx" ON "CourseModule"("parentId");
DO $$ BEGIN
  ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order: coupon + offer fields
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offerId" TEXT;

-- CourseOffer (access pricing tiers)
CREATE TABLE IF NOT EXISTS "CourseOffer" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'PKR',
  "accessDurationDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "index" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseOffer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseOffer_courseId_idx" ON "CourseOffer"("courseId");
DO $$ BEGIN
  ALTER TABLE "CourseOffer" ADD CONSTRAINT "CourseOffer_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coupon (global)
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");

-- CourseComment
CREATE TABLE IF NOT EXISTS "CourseComment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lessonId" TEXT,
  "body" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseComment_courseId_idx" ON "CourseComment"("courseId");
DO $$ BEGIN
  ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CourseBadge
CREATE TABLE IF NOT EXISTS "CourseBadge" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'WELCOME',
  "name" TEXT NOT NULL,
  "imageUrl" TEXT,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseBadge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseBadge_courseId_idx" ON "CourseBadge"("courseId");
DO $$ BEGIN
  ALTER TABLE "CourseBadge" ADD CONSTRAINT "CourseBadge_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LiveSession
CREATE TABLE IF NOT EXISTS "LiveSession" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  "joinUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LiveSession_courseId_idx" ON "LiveSession"("courseId");
DO $$ BEGIN
  ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
