-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PASSED', 'FAILED', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT,
    "suiteName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "source" TEXT,
    "commitSha" TEXT,
    "branch" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "env" JSONB,
    "meta" JSONB,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL,
    "durationMs" INTEGER,
    "message" TEXT,
    "stacktrace" TEXT,
    "stdout" TEXT,
    "stderr" TEXT,
    "meta" JSONB,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orgId_slug_key" ON "Project"("orgId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");

-- CreateIndex
CREATE INDEX "TestCase_projectId_name_idx" ON "TestCase"("projectId", "name");

-- CreateIndex
CREATE INDEX "TestCase_projectId_suiteName_idx" ON "TestCase"("projectId", "suiteName");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_projectId_externalId_key" ON "TestCase"("projectId", "externalId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_createdAt_idx" ON "TestRun"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TestRun_projectId_status_idx" ON "TestRun"("projectId", "status");

-- CreateIndex
CREATE INDEX "TestRun_projectId_branch_idx" ON "TestRun"("projectId", "branch");

-- CreateIndex
CREATE INDEX "TestResult_runId_status_idx" ON "TestResult"("runId", "status");

-- CreateIndex
CREATE INDEX "TestResult_testCaseId_idx" ON "TestResult"("testCaseId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
