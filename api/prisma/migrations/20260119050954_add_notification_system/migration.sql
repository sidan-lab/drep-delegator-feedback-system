-- CreateEnum
CREATE TYPE "AlertRecipientType" AS ENUM ('DREP', 'DELEGATOR');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('DISCORD_CHANNEL', 'DISCORD_DM', 'WEB_PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "drepId" TEXT,
    "verifiedDelegatorId" TEXT,
    "discordUserId" TEXT,
    "discordChannelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discordDmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webPushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alertDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "pushSubscription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadlineAlert" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "recipientType" "AlertRecipientType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "alertChannel" "AlertChannel" NOT NULL,
    "daysBeforeExpiry" INTEGER NOT NULL,
    "drepHasVoted" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadlineAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_drepId_key" ON "NotificationPreference"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_verifiedDelegatorId_key" ON "NotificationPreference"("verifiedDelegatorId");

-- CreateIndex
CREATE INDEX "NotificationPreference_discordUserId_idx" ON "NotificationPreference"("discordUserId");

-- CreateIndex
CREATE INDEX "NotificationPreference_webPushEnabled_idx" ON "NotificationPreference"("webPushEnabled");

-- CreateIndex
CREATE INDEX "DeadlineAlert_proposalId_idx" ON "DeadlineAlert"("proposalId");

-- CreateIndex
CREATE INDEX "DeadlineAlert_drepId_idx" ON "DeadlineAlert"("drepId");

-- CreateIndex
CREATE INDEX "DeadlineAlert_deliveryStatus_idx" ON "DeadlineAlert"("deliveryStatus");

-- CreateIndex
CREATE INDEX "DeadlineAlert_createdAt_idx" ON "DeadlineAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineAlert_proposalId_drepId_recipientType_recipientId_a_key" ON "DeadlineAlert"("proposalId", "drepId", "recipientType", "recipientId", "alertChannel", "daysBeforeExpiry");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "DrepRegistration"("drepId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_verifiedDelegatorId_fkey" FOREIGN KEY ("verifiedDelegatorId") REFERENCES "VerifiedDelegator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
