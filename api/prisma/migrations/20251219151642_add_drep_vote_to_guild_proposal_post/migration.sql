-- AlterTable
ALTER TABLE "GuildProposalPost" ADD COLUMN     "discordNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "drepRationaleUrl" TEXT,
ADD COLUMN     "drepVote" "VoteType",
ADD COLUMN     "drepVoteTxHash" TEXT,
ADD COLUMN     "drepVotedAt" TIMESTAMP(3);
