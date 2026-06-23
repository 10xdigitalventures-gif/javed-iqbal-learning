-- =============================================================================
-- Prof. Dr. Javed Iqbal Learning App — Complete baseline migration
-- Replaces the previous delta migration. Safe to run on a fully fresh
-- PostgreSQL database (e.g. Supabase, Railway, local Docker).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONSULTANT', 'CLIENT');
CREATE TYPE "PackageType" AS ENUM ('ONE_TIME', 'MONTHLY', 'ANNUAL', 'CUSTOM');
CREATE TYPE "PackageChannel" AS ENUM ('TEXT', 'AUDIO', 'VIDEO', 'COMBINED');
CREATE TYPE "PurchaseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'AUDIO', 'VIDEO');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
CREATE TYPE "MeetingStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentKind" AS ENUM ('ONE_TIME', 'SUBSCRIPTION');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET');
CREATE TYPE "LearningProductKind" AS ENUM ('BOOK', 'BUNDLE', 'SUBSCRIPTION');
CREATE TYPE "AccessType" AS ENUM ('LIFETIME', 'SUBSCRIPTION');
CREATE TYPE "EntitlementSource" AS ENUM ('PURCHASE', 'BUNDLE', 'SUBSCRIPTION', 'ADMIN_GRANT');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "SubscriptionInterval" AS ENUM ('MONTHLY', 'SIX_MONTHS', 'YEARLY', 'LIFETIME');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "HardCopyOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'PDF', 'TEXT', 'QUIZ', 'ASSIGNMENT');

-- ---------------------------------------------------------------------------
-- TABLES (ordered by FK dependency)
-- ---------------------------------------------------------------------------

-- User
CREATE TABLE "User" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "phone"     TEXT,
    "role"      "Role" NOT NULL DEFAULT 'CLIENT',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "bio"       TEXT,
    "expertise" TEXT,
    "title"     TEXT,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Package (consultation plans)
CREATE TABLE "Package" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "type"              "PackageType" NOT NULL DEFAULT 'ONE_TIME',
    "channel"           "PackageChannel" NOT NULL DEFAULT 'COMBINED',
    "price"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"          TEXT NOT NULL DEFAULT 'PKR',
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "isGlobal"          BOOLEAN NOT NULL DEFAULT false,
    "textLimit"         INTEGER,
    "audioLimit"        INTEGER,
    "videoLimit"        INTEGER,
    "sessionLimit"      INTEGER,
    "sessionDuration"   INTEGER,
    "audioDuration"     INTEGER,
    "videoDuration"     INTEGER,
    "responseAllowance" INTEGER,
    "billingDays"       INTEGER,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- Purchase (consultation purchases)
CREATE TABLE "Purchase" (
    "id"             TEXT NOT NULL,
    "clientId"       TEXT NOT NULL,
    "consultantId"   TEXT,
    "packageId"      TEXT NOT NULL,
    "status"         "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "autoRenew"      BOOLEAN NOT NULL DEFAULT false,
    "textLimit"      INTEGER,
    "audioLimit"     INTEGER,
    "videoLimit"     INTEGER,
    "sessionLimit"   INTEGER,
    "sessionDuration" INTEGER,
    "audioDuration"  INTEGER,
    "videoDuration"  INTEGER,
    "textUsed"       INTEGER NOT NULL DEFAULT 0,
    "audioUsed"      INTEGER NOT NULL DEFAULT 0,
    "videoUsed"      INTEGER NOT NULL DEFAULT 0,
    "sessionsUsed"   INTEGER NOT NULL DEFAULT 0,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- Conversation
CREATE TABLE "Conversation" (
    "id"            TEXT NOT NULL,
    "clientId"      TEXT NOT NULL,
    "consultantId"  TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Conversation_clientId_consultantId_key" ON "Conversation"("clientId", "consultantId");

-- Message
CREATE TABLE "Message" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId"       TEXT NOT NULL,
    "purchaseId"     TEXT,
    "type"           "MessageType" NOT NULL DEFAULT 'TEXT',
    "body"           TEXT,
    "mediaUrl"       TEXT,
    "durationSec"    INTEGER,
    "status"         "MessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Availability
CREATE TABLE "Availability" (
    "id"           TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "weekday"      INTEGER NOT NULL,
    "startTime"    TEXT NOT NULL,
    "endTime"      TEXT NOT NULL,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- Meeting
CREATE TABLE "Meeting" (
    "id"           TEXT NOT NULL,
    "clientId"     TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "purchaseId"   TEXT,
    "title"        TEXT NOT NULL,
    "scheduledAt"  TIMESTAMP(3) NOT NULL,
    "durationMin"  INTEGER NOT NULL DEFAULT 30,
    "status"       "MeetingStatus" NOT NULL DEFAULT 'REQUESTED',
    "meetingUrl"   TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE "Notification" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "channel"   "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Community
CREATE TABLE "Community" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isPaid"      BOOLEAN NOT NULL DEFAULT false,
    "price"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"    TEXT NOT NULL DEFAULT 'PKR',
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CommunityMember
CREATE TABLE "CommunityMember" (
    "id"          TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CommunityPost
CREATE TABLE "CommunityPost" (
    "id"             TEXT NOT NULL,
    "communityId"    TEXT NOT NULL,
    "authorId"       TEXT NOT NULL,
    "body"           TEXT NOT NULL,
    "mediaUrl"       TEXT,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CommunityComment
CREATE TABLE "CommunityComment" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

-- OtpCode
CREATE TABLE "OtpCode" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "purpose"   "OtpPurpose" NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- ActivityLog
CREATE TABLE "ActivityLog" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "action"    TEXT NOT NULL,
    "meta"      TEXT,
    "ip"        TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- PlatformSetting
CREATE TABLE "PlatformSetting" (
    "id"        TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- BookCategory
CREATE TABLE "BookCategory" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "icon"      TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookCategory_name_key" ON "BookCategory"("name");
CREATE UNIQUE INDEX "BookCategory_slug_key" ON "BookCategory"("slug");

-- Book
CREATE TABLE "Book" (
    "id"                TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "slug"              TEXT NOT NULL,
    "author"            TEXT NOT NULL DEFAULT 'Prof. Dr. Javed Iqbal',
    "description"       TEXT,
    "coverUrl"          TEXT,
    "language"          TEXT NOT NULL DEFAULT 'en',
    "pageCount"         INTEGER,
    "categoryId"        TEXT,
    "price"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"          TEXT NOT NULL DEFAULT 'PKR',
    "hardCopyPrice"     DOUBLE PRECISION,
    "allowHardCopy"     BOOLEAN NOT NULL DEFAULT false,
    "accessType"        "AccessType" NOT NULL DEFAULT 'LIFETIME',
    "isFeatured"        BOOLEAN NOT NULL DEFAULT false,
    "isPublished"       BOOLEAN NOT NULL DEFAULT true,
    "contentKey"        TEXT,
    "previewContentKey" TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- Chapter
CREATE TABLE "Chapter" (
    "id"         TEXT NOT NULL,
    "bookId"     TEXT NOT NULL,
    "index"      INTEGER NOT NULL,
    "title"      TEXT NOT NULL,
    "contentKey" TEXT,
    "pageStart"  INTEGER,
    "pageEnd"    INTEGER,
    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Chapter_bookId_index_key" ON "Chapter"("bookId", "index");

-- Bundle
CREATE TABLE "Bundle" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "coverUrl"    TEXT,
    "price"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"    TEXT NOT NULL DEFAULT 'PKR',
    "isFeatured"  BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- BundleItem
CREATE TABLE "BundleItem" (
    "id"       TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "bookId"   TEXT NOT NULL,
    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BundleItem_bundleId_bookId_key" ON "BundleItem"("bundleId", "bookId");

-- SubscriptionPlan
CREATE TABLE "SubscriptionPlan" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "interval"     "SubscriptionInterval" NOT NULL DEFAULT 'MONTHLY',
    "durationDays" INTEGER,
    "price"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"     TEXT NOT NULL DEFAULT 'PKR',
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "features"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- Order (must come before Payment so Payment can FK to it)
CREATE TABLE "Order" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "kind"     "LearningProductKind" NOT NULL,
    "status"   "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "amount"   DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "bookId"   TEXT,
    "bundleId" TEXT,
    "planId"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- Payment
CREATE TABLE "Payment" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "purchaseId" TEXT,
    "orderId"    TEXT,
    "amount"     DOUBLE PRECISION NOT NULL,
    "currency"   TEXT NOT NULL DEFAULT 'PKR',
    "gateway"    TEXT NOT NULL DEFAULT 'mock',
    "kind"       "PaymentKind" NOT NULL DEFAULT 'ONE_TIME',
    "status"     "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference"  TEXT,
    "invoiceNo"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Entitlement
CREATE TABLE "Entitlement" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "bookId"    TEXT NOT NULL,
    "source"    "EntitlementSource" NOT NULL DEFAULT 'PURCHASE',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Entitlement_userId_bookId_key" ON "Entitlement"("userId", "bookId");

-- OfflineContent
CREATE TABLE "OfflineContent" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "bookId"         TEXT NOT NULL,
    "wrappedKeyRef"  TEXT,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "sizeBytes"      INTEGER,
    "downloadedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfflineContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfflineContent_userId_bookId_key" ON "OfflineContent"("userId", "bookId");

-- ReadingProgress
CREATE TABLE "ReadingProgress" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "bookId"            TEXT NOT NULL,
    "lastChapterIndex"  INTEGER NOT NULL DEFAULT 0,
    "lastPage"          INTEGER NOT NULL DEFAULT 0,
    "percentComplete"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chaptersCompleted" INTEGER NOT NULL DEFAULT 0,
    "readingSeconds"    INTEGER NOT NULL DEFAULT 0,
    "isCompleted"       BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReadingProgress_userId_bookId_key" ON "ReadingProgress"("userId", "bookId");

-- Bookmark
CREATE TABLE "Bookmark" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "bookId"    TEXT NOT NULL,
    "chapterId" TEXT,
    "page"      INTEGER NOT NULL,
    "label"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- Highlight
CREATE TABLE "Highlight" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "bookId"    TEXT NOT NULL,
    "chapterId" TEXT,
    "page"      INTEGER NOT NULL,
    "text"      TEXT NOT NULL,
    "color"     TEXT NOT NULL DEFAULT '#FF7A1A',
    "position"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- ReaderNote
CREATE TABLE "ReaderNote" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "bookId"    TEXT NOT NULL,
    "chapterId" TEXT,
    "page"      INTEGER NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaderNote_pkey" PRIMARY KEY ("id")
);

-- Subscription
CREATE TABLE "Subscription" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "planId"    TEXT NOT NULL,
    "status"    "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- HardCopyOrder
CREATE TABLE "HardCopyOrder" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "bookId"    TEXT,
    "name"      TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "address"   TEXT NOT NULL,
    "city"      TEXT NOT NULL,
    "quantity"  INTEGER NOT NULL DEFAULT 1,
    "status"    "HardCopyOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HardCopyOrder_pkey" PRIMARY KEY ("id")
);

-- CommunityPostLike
CREATE TABLE "CommunityPostLike" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityPostLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityPostLike_postId_userId_key" ON "CommunityPostLike"("postId", "userId");

-- ---------------------------------------------------------------------------
-- FUTURE COURSE SYSTEM (scaffolded)
-- ---------------------------------------------------------------------------

CREATE TABLE "Course" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "coverUrl"    TEXT,
    "price"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"    TEXT NOT NULL DEFAULT 'PKR',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

CREATE TABLE "Lesson" (
    "id"          TEXT NOT NULL,
    "courseId"    TEXT NOT NULL,
    "index"       INTEGER NOT NULL,
    "title"       TEXT NOT NULL,
    "type"        "LessonType" NOT NULL DEFAULT 'VIDEO',
    "contentKey"  TEXT,
    "durationSec" INTEGER,
    "isPreview"   BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Lesson_courseId_index_key" ON "Lesson"("courseId", "index");

CREATE TABLE "Enrollment" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "courseId"        TEXT NOT NULL,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lessonsComplete" INTEGER NOT NULL DEFAULT 0,
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP(3),
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

CREATE TABLE "Quiz" (
    "id"        TEXT NOT NULL,
    "courseId"  TEXT NOT NULL,
    "lessonId"  TEXT,
    "title"     TEXT NOT NULL,
    "passScore" INTEGER NOT NULL DEFAULT 70,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");

CREATE TABLE "QuizQuestion" (
    "id"      TEXT NOT NULL,
    "quizId"  TEXT NOT NULL,
    "index"   INTEGER NOT NULL,
    "prompt"  TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answer"  INTEGER NOT NULL,
    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizQuestion_quizId_index_key" ON "QuizQuestion"("quizId", "index");

CREATE TABLE "QuizAttempt" (
    "id"        TEXT NOT NULL,
    "quizId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "score"     INTEGER NOT NULL DEFAULT 0,
    "passed"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
    "id"          TEXT NOT NULL,
    "courseId"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "dueAt"       TIMESTAMP(3),
    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmission" (
    "id"           TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "contentKey"   TEXT,
    "grade"        INTEGER,
    "feedback"     TEXT,
    "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");

CREATE TABLE "Certificate" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "serial"   TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");

-- ---------------------------------------------------------------------------
-- PRISMA IMPLICIT MANY-TO-MANY: Package <-> User (consultant assignments)
-- ---------------------------------------------------------------------------
CREATE TABLE "_PackageConsultants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_PackageConsultants_AB_unique" ON "_PackageConsultants"("A", "B");
CREATE INDEX "_PackageConsultants_B_index" ON "_PackageConsultants"("B");

-- ---------------------------------------------------------------------------
-- FOREIGN KEY CONSTRAINTS
-- ---------------------------------------------------------------------------

-- Purchase
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_consultantId_fkey"
    FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conversation
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_consultantId_fkey"
    FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Message
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Availability
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_consultantId_fkey"
    FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Meeting
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_consultantId_fkey"
    FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CommunityMember
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CommunityPost
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CommunityComment
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ActivityLog
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Book
ALTER TABLE "Book" ADD CONSTRAINT "Book_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "BookCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Chapter
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BundleItem
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Entitlement
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OfflineContent
ALTER TABLE "OfflineContent" ADD CONSTRAINT "OfflineContent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineContent" ADD CONSTRAINT "OfflineContent_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ReadingProgress
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bookmark
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Highlight
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReaderNote
ALTER TABLE "ReaderNote" ADD CONSTRAINT "ReaderNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReaderNote" ADD CONSTRAINT "ReaderNote_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReaderNote" ADD CONSTRAINT "ReaderNote_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Subscription
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HardCopyOrder
ALTER TABLE "HardCopyOrder" ADD CONSTRAINT "HardCopyOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HardCopyOrder" ADD CONSTRAINT "HardCopyOrder_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CommunityPostLike
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lesson
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enrollment
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quiz
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- QuizQuestion
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QuizAttempt
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Assignment
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AssignmentSubmission
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- _PackageConsultants M2M
ALTER TABLE "_PackageConsultants" ADD CONSTRAINT "_PackageConsultants_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PackageConsultants" ADD CONSTRAINT "_PackageConsultants_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
