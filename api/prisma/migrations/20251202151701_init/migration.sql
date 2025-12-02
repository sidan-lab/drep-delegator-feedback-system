-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "VoterType" AS ENUM ('DREP', 'SPO', 'CC');

-- CreateEnum
CREATE TYPE "GovernanceType" AS ENUM ('INFO', 'TREASURY', 'CONSTITUTION', 'HARD_FORK', 'PROTOCOL_PARAMETER_CHANGE', 'NO_CONFIDENCE', 'UPDATE_COMMITTEE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('ACTIVE', 'RATIFIED', 'EXPIRED', 'APPROVED', 'NOT_APPROVED');

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
    "userId" TEXT,
    "name" TEXT,
    "paymentAddress" TEXT,
    "iconUrl" TEXT,
    "votingPower" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Drep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPO" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT,
    "poolName" TEXT,
    "ticker" TEXT,
    "iconUrl" TEXT,
    "votingPower" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SPO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CC" (
    "id" TEXT NOT NULL,
    "ccId" TEXT NOT NULL,
    "userId" TEXT,
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
    "expiryEpoch" INTEGER,
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
    "votingPower" TEXT,
    "votingPowerAda" DOUBLE PRECISION,
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

-- CreateIndex
CREATE UNIQUE INDEX "Drep_drepId_key" ON "Drep"("drepId");

-- CreateIndex
CREATE UNIQUE INDEX "Drep_userId_key" ON "Drep"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SPO_poolId_key" ON "SPO"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "SPO_userId_key" ON "SPO"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CC_ccId_key" ON "CC"("ccId");

-- CreateIndex
CREATE UNIQUE INDEX "CC_userId_key" ON "CC"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalId_key" ON "Proposal"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_txHash_certIndex_key" ON "Proposal"("txHash", "certIndex");

-- CreateIndex
CREATE UNIQUE INDEX "OnchainVote_proposalId_voterType_drepId_spoId_ccId_key" ON "OnchainVote"("proposalId", "voterType", "drepId", "spoId", "ccId");

-- AddForeignKey
ALTER TABLE "Drep" ADD CONSTRAINT "Drep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SPO" ADD CONSTRAINT "SPO_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CC" ADD CONSTRAINT "CC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("proposalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_drepId_fkey" FOREIGN KEY ("drepId") REFERENCES "Drep"("drepId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SPO"("poolId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnchainVote" ADD CONSTRAINT "OnchainVote_ccId_fkey" FOREIGN KEY ("ccId") REFERENCES "CC"("ccId") ON DELETE SET NULL ON UPDATE CASCADE;
