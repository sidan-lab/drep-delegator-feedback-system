/*
  Warnings:

  - You are about to drop the column `verifiedDelegatorId` on the `NotificationPreference` table. All the data in the column will be lost.
  - Made the column `drepId` on table `NotificationPreference` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "NotificationPreference" DROP CONSTRAINT "NotificationPreference_drepId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationPreference" DROP CONSTRAINT "NotificationPreference_verifiedDelegatorId_fkey";

-- DropIndex
DROP INDEX "NotificationPreference_verifiedDelegatorId_key";

-- AlterTable
ALTER TABLE "NotificationPreference" DROP COLUMN "verifiedDelegatorId",
ALTER COLUMN "drepId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "DrepRegistration"("drepId") ON DELETE RESTRICT ON UPDATE CASCADE;
