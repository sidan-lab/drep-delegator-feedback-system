/*
  Warnings:

  - You are about to drop the `ProposalSentiment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[proposalId,drepId]` on the table `GuildProposalPost` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GuildProposalPost" ADD COLUMN     "abstainCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yesCount" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ProposalSentiment";

-- CreateIndex
CREATE UNIQUE INDEX "GuildProposalPost_proposalId_drepId_key" ON "GuildProposalPost"("proposalId", "drepId");
