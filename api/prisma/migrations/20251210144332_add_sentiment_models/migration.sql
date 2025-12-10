-- CreateEnum
CREATE TYPE "SentimentType" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DrepRegistration" (
    "id" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "drepName" TEXT,
    "contactEmail" TEXT,
    "discordServerId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "apiKey" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrepRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedDelegator" (
    "id" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "stakeAddress" TEXT NOT NULL,
    "liveStake" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedDelegator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordGuild" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "governanceChannelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordReaction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "sentiment" "SentimentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordComment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" "SentimentType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSentiment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "yesCount" INTEGER NOT NULL DEFAULT 0,
    "noCount" INTEGER NOT NULL DEFAULT 0,
    "abstainCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSentiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrepRegistration_drepId_key" ON "DrepRegistration"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "DrepRegistration_apiKey_key" ON "DrepRegistration"("apiKey");

-- CreateIndex
CREATE INDEX "DrepRegistration_apiKey_idx" ON "DrepRegistration"("apiKey");

-- CreateIndex
CREATE INDEX "DrepRegistration_status_idx" ON "DrepRegistration"("status");

-- CreateIndex
CREATE INDEX "VerifiedDelegator_drepId_idx" ON "VerifiedDelegator"("drepId");

-- CreateIndex
CREATE INDEX "VerifiedDelegator_discordUserId_idx" ON "VerifiedDelegator"("discordUserId");

-- CreateIndex
CREATE INDEX "VerifiedDelegator_isActive_idx" ON "VerifiedDelegator"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDelegator_drepId_discordUserId_key" ON "VerifiedDelegator"("drepId", "discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDelegator_drepId_stakeAddress_key" ON "VerifiedDelegator"("drepId", "stakeAddress");

-- CreateIndex
CREATE INDEX "DiscordGuild_drepId_idx" ON "DiscordGuild"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordGuild_guildId_drepId_key" ON "DiscordGuild"("guildId", "drepId");

-- CreateIndex
CREATE INDEX "DiscordReaction_proposalId_idx" ON "DiscordReaction"("proposalId");

-- CreateIndex
CREATE INDEX "DiscordReaction_drepId_idx" ON "DiscordReaction"("drepId");

-- CreateIndex
CREATE INDEX "DiscordReaction_guildId_idx" ON "DiscordReaction"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordReaction_proposalId_drepId_guildId_discordUserId_key" ON "DiscordReaction"("proposalId", "drepId", "guildId", "discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordComment_messageId_key" ON "DiscordComment"("messageId");

-- CreateIndex
CREATE INDEX "DiscordComment_proposalId_idx" ON "DiscordComment"("proposalId");

-- CreateIndex
CREATE INDEX "DiscordComment_drepId_idx" ON "DiscordComment"("drepId");

-- CreateIndex
CREATE INDEX "DiscordComment_guildId_idx" ON "DiscordComment"("guildId");

-- CreateIndex
CREATE INDEX "ProposalSentiment_proposalId_idx" ON "ProposalSentiment"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalSentiment_drepId_idx" ON "ProposalSentiment"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSentiment_proposalId_drepId_key" ON "ProposalSentiment"("proposalId", "drepId");

-- AddForeignKey
ALTER TABLE "VerifiedDelegator" ADD CONSTRAINT "VerifiedDelegator_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "DrepRegistration"("drepId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordGuild" ADD CONSTRAINT "DiscordGuild_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "DrepRegistration"("drepId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordReaction" ADD CONSTRAINT "DiscordReaction_guildId_drepId_fkey" FOREIGN KEY ("guildId", "drepId") REFERENCES "DiscordGuild"("guildId", "drepId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordReaction" ADD CONSTRAINT "DiscordReaction_drepId_discordUserId_fkey" FOREIGN KEY ("drepId", "discordUserId") REFERENCES "VerifiedDelegator"("drepId", "discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordComment" ADD CONSTRAINT "DiscordComment_guildId_drepId_fkey" FOREIGN KEY ("guildId", "drepId") REFERENCES "DiscordGuild"("guildId", "drepId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordComment" ADD CONSTRAINT "DiscordComment_drepId_discordUserId_fkey" FOREIGN KEY ("drepId", "discordUserId") REFERENCES "VerifiedDelegator"("drepId", "discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
