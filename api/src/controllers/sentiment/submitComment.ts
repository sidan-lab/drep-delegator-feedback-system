import { Request, Response } from "express";
import { SentimentType, ProposalStatus } from "@prisma/client";
import { prisma } from "../../services";
import { validateGuildId } from "../../middleware/auth.middleware";

/**
 * Submit a comment from Discord
 */
export const submitComment = async (req: Request, res: Response) => {
  try {
    const {
      proposalId,
      drepId,
      guildId,
      guildName,
      channelId,
      discordUserId,
      discordUsername,
      messageId,
      content,
      sentiment,
    } = req.body;

    // Validate required fields
    if (
      !proposalId ||
      !drepId ||
      !guildId ||
      !channelId ||
      !discordUserId ||
      !messageId ||
      !content
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        message:
          "proposalId, drepId, guildId, channelId, discordUserId, messageId, and content are required",
      });
    }

    // Validate sentiment type if provided
    let sentimentUpper: SentimentType | null = null;
    if (sentiment) {
      sentimentUpper = sentiment.toUpperCase() as SentimentType;
      if (!["YES", "NO", "ABSTAIN"].includes(sentimentUpper)) {
        return res.status(400).json({
          error: "Invalid sentiment",
          message: "sentiment must be 'yes', 'no', or 'abstain'",
        });
      }
    }

    // Validate guild ID matches registered Discord server for this DRep
    const guildValidation = validateGuildId(req, guildId);
    if (!guildValidation.valid) {
      return res.status(403).json({
        error: "Unauthorized Discord server",
        message: guildValidation.error,
      });
    }

    // Verify DRep is registered and approved
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!drepRegistration || drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        error: "DRep not authorized",
        message: "This DRep is not authorized for sentiment collection",
      });
    }

    // Verify proposal exists and is still active
    const proposal = await prisma.proposal.findUnique({
      where: { proposalId },
      select: { status: true },
    });

    if (!proposal) {
      return res.status(404).json({
        error: "Proposal not found",
        message: "This proposal does not exist in the database",
      });
    }

    if (proposal.status !== ProposalStatus.ACTIVE) {
      return res.status(400).json({
        error: "Proposal not active",
        message: "Comments can only be submitted for active proposals",
      });
    }

    // Ensure guild is registered (auto-register if not)
    await prisma.discordGuild.upsert({
      where: {
        guildId_drepId: { guildId, drepId },
      },
      update: {
        guildName: guildName || "Unknown",
      },
      create: {
        guildId,
        guildName: guildName || "Unknown",
        drepId,
        isActive: true,
      },
    });

    // Find existing reaction for this user on this proposal
    // Comments are now stored as part of the reaction record
    const existingReaction = await prisma.discordReaction.findUnique({
      where: {
        proposalId_drepId_guildId_discordUserId: {
          proposalId,
          drepId,
          guildId,
          discordUserId,
        },
      },
    });

    if (existingReaction) {
      // Update existing reaction with the comment
      await prisma.discordReaction.update({
        where: { id: existingReaction.id },
        data: {
          comment: content,
          messageId,
          // Update sentiment if provided
          ...(sentimentUpper && { sentiment: sentimentUpper }),
        },
      });
    } else {
      // No existing reaction - create one with the comment
      // Sentiment is required for a reaction, use provided or default to comment-only
      if (!sentimentUpper) {
        return res.status(400).json({
          error: "Missing sentiment",
          message: "A sentiment (yes/no/abstain) is required when submitting a comment without an existing vote",
        });
      }

      await prisma.discordReaction.create({
        data: {
          proposalId,
          drepId,
          guildId,
          channelId,
          discordUserId,
          discordUsername: discordUsername || "Unknown",
          sentiment: sentimentUpper,
          comment: content,
          messageId,
        },
      });
    }

    // Update aggregated sentiment summary in GuildProposalPost
    await updateSentimentSummary(proposalId, drepId, guildId);

    return res.status(200).json({
      success: true,
      message: "Comment submitted successfully",
    });
  } catch (error) {
    console.error("[Sentiment] Error submitting comment:", error);
    return res.status(500).json({
      error: "Failed to submit comment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update the aggregated sentiment summary for a proposal
 * Updates counts in GuildProposalPost (combined with proposal post tracking)
 */
async function updateSentimentSummary(
  proposalId: string,
  drepId: string,
  guildId: string
): Promise<void> {
  // Count reactions by sentiment and comments (reactions with non-null comment)
  const [yesCount, noCount, abstainCount, commentCount] = await Promise.all([
    prisma.discordReaction.count({
      where: { proposalId, drepId, sentiment: "YES" },
    }),
    prisma.discordReaction.count({
      where: { proposalId, drepId, sentiment: "NO" },
    }),
    prisma.discordReaction.count({
      where: { proposalId, drepId, sentiment: "ABSTAIN" },
    }),
    prisma.discordReaction.count({
      where: { proposalId, drepId, comment: { not: null } },
    }),
  ]);

  // Update sentiment counts in GuildProposalPost
  // The post should already exist (created when proposal was posted to Discord)
  await prisma.guildProposalPost.update({
    where: {
      guildId_drepId_proposalId: { guildId, drepId, proposalId },
    },
    data: {
      yesCount,
      noCount,
      abstainCount,
      commentCount,
    },
  });
}
