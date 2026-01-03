/*
  Warnings:

  - You are about to drop the `LastIngestedTime` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "LastIngestedTime";

-- CreateTable
CREATE TABLE "SyncStatus" (
    "jobName" TEXT NOT NULL,
    "displayName" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "errorMessage" TEXT,
    "itemsProcessed" INTEGER,
    "lockedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("jobName")
);
