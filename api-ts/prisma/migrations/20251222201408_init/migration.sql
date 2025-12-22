/*
  Warnings:

  - A unique constraint covering the columns `[runId,testCaseId]` on the table `TestResult` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TestRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_runId_testCaseId_key" ON "TestResult"("runId", "testCaseId");
