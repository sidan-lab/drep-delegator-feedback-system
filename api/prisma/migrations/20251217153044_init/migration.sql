-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "VoterType" AS ENUM ('DREP', 'SPO', 'CC');

-- CreateEnum
CREATE TYPE "GovernanceType" AS ENUM ('INFO_ACTION', 'TREASURY_WITHDRAWALS', 'NEW_CONSTITUTION', 'HARD_FORK_INITIATION', 'PROTOCOL_PARAMETER_CHANGE', 'NO_CONFIDENCE', 'UPDATE_COMMITTEE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('ACTIVE', 'RATIFIED', 'ENACTED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SentimentType" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "stakeKeyLovelace" DOUBLE PRECISION,
    "jwt" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drep" (
    "id" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "name" TEXT,
    "paymentAddress" TEXT,
    "iconUrl" TEXT,
    "doNotList" BOOLEAN,
    "votingPower" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Drep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPO" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "poolName" TEXT,
    "ticker" TEXT,
    "iconUrl" TEXT,
    "votingPower" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SPO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CC" (
    "id" TEXT NOT NULL,
    "ccId" TEXT NOT NULL,
    "memberName" TEXT,
    "hotCredential" TEXT,
    "coldCredential" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastIngestedTime" (
    "id" TEXT NOT NULL,

    CONSTRAINT "LastIngestedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" SERIAL NOT NULL,
    "proposalId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "certIndex" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rationale" TEXT,
    "governanceActionType" "GovernanceType",
    "status" "ProposalStatus" NOT NULL DEFAULT 'ACTIVE',
    "submissionEpoch" INTEGER,
    "ratifiedEpoch" INTEGER,
    "enactedEpoch" INTEGER,
    "droppedEpoch" INTEGER,
    "expiredEpoch" INTEGER,
    "expirationEpoch" INTEGER,
    "drepTotalVotePower" BIGINT,
    "drepActiveYesVotePower" BIGINT,
    "drepActiveNoVotePower" BIGINT,
    "drepActiveAbstainVotePower" BIGINT,
    "drepAlwaysAbstainVotePower" BIGINT,
    "drepAlwaysNoConfidenceVotePower" BIGINT,
    "drepInactiveVotePower" BIGINT,
    "spoTotalVotePower" BIGINT,
    "spoActiveYesVotePower" BIGINT,
    "spoActiveNoVotePower" BIGINT,
    "spoActiveAbstainVotePower" BIGINT,
    "spoAlwaysAbstainVotePower" BIGINT,
    "spoAlwaysNoConfidenceVotePower" BIGINT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnchainVote" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "vote" "VoteType",
    "voterType" "VoterType" NOT NULL,
    "votingPower" BIGINT,
    "anchorUrl" TEXT,
    "anchorHash" TEXT,
    "votedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "drepId" TEXT,
    "spoId" TEXT,
    "ccId" TEXT,

    CONSTRAINT "OnchainVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCL" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "epoch" INTEGER NOT NULL,
    "current" BIGINT NOT NULL DEFAULT 0,
    "limit" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NCL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrepRegistration" (
    "id" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "drepName" TEXT,
    "contactEmail" TEXT,
    "userId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rationale" TEXT,
    "apiKey" TEXT,
    "reviewedAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "GuildProposalPost" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "drepId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildProposalPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Drep_drepId_key" ON "Drep"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "SPO_poolId_key" ON "SPO"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "CC_ccId_key" ON "CC"("ccId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalId_key" ON "Proposal"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_txHash_certIndex_key" ON "Proposal"("txHash", "certIndex");

-- CreateIndex
CREATE UNIQUE INDEX "OnchainVote_txHash_proposalId_voterType_drepId_spoId_ccId_key" ON "OnchainVote"("txHash", "proposalId", "voterType", "drepId", "spoId", "ccId");

-- CreateIndex
CREATE UNIQUE INDEX "NCL_year_key" ON "NCL"("year");

-- CreateIndex
CREATE UNIQUE INDEX "DrepRegistration_drepId_key" ON "DrepRegistration"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "DrepRegistration_userId_key" ON "DrepRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DrepRegistration_apiKey_key" ON "DrepRegistration"("apiKey");

-- CreateIndex
CREATE INDEX "DrepRegistration_apiKey_idx" ON "DrepRegistration"("apiKey");

-- CreateIndex
CREATE INDEX "DrepRegistration_status_idx" ON "DrepRegistration"("status");

-- CreateIndex
CREATE INDEX "DrepRegistration_userId_idx" ON "DrepRegistration"("userId");

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

-- CreateIndex
CREATE INDEX "GuildProposalPost_proposalId_idx" ON "GuildProposalPost"("proposalId");

-- CreateIndex
CREATE INDEX "GuildProposalPost_threadId_idx" ON "GuildProposalPost"("threadId");

-- CreateIndex
CREATE INDEX "GuildProposalPost_drepId_idx" ON "GuildProposalPost"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildProposalPost_guildId_drepId_proposalId_key" ON "GuildProposalPost"("guildId", "drepId", "proposalId");

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("proposalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "Drep"("drepId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SPO"("poolId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_ccId_fkey" FOREIGN KEY ("ccId") REFERENCES "CC"("ccId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrepRegistration" ADD CONSTRAINT "DrepRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "GuildProposalPost" ADD CONSTRAINT "GuildProposalPost_guildId_drepId_fkey" FOREIGN KEY ("guildId", "drepId") REFERENCES "DiscordGuild"("guildId", "drepId") ON DELETE RESTRICT ON UPDATE CASCADE;
