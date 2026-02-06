-- AlterTable
ALTER TABLE "GuildProposalPost" ADD COLUMN     "draftPublishedAt" TIMESTAMP(3),
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "GuildProposalPost_isDraft_idx" ON "GuildProposalPost"("isDraft");
