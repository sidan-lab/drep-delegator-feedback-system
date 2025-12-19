import { Request, Response } from "express";
import { SentimentType, ProposalStatus } from "@prisma/client";
import { prisma } from "../../services";
import { validateGuildId } from "../../middleware/auth.middleware";

/**
 * Submit or remove a reaction from Discord
 */
export const submitReaction = async (req: Request, res: Response) => {
  try {
    const {
      proposalId,
      drepId,
      guildId,
      guildName,
      channelId,
      discordUserId,
      discordUsername,
      sentiment,
      action,
    } = req.body;

    // Validate required fields
    if (
      !proposalId ||
      !drepId ||
      !guildId ||
      !channelId ||
      !discordUserId ||
      !sentiment ||
      !action
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        message:
          "proposalId, drepId, guildId, channelId, discordUserId, sentiment, and action are required",
      });
    }

    // Validate sentiment type
    const sentimentUpper = sentiment.toUpperCase() as SentimentType;
    if (!["YES", "NO", "ABSTAIN"].includes(sentimentUpper)) {
      return res.status(400).json({
        error: "Invalid sentiment",
        message: "sentiment must be 'yes', 'no', or 'abstain'",
      });
    }

    // Validate action
    if (!["add", "remove"].includes(action)) {
      return res.status(400).json({
        error: "Invalid action",
        message: "action must be 'add' or 'remove'",
      });
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
        message: "Sentiment can only be submitted for active proposals",
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

    if (action === "add") {
      // Upsert reaction (allows changing vote)
      await prisma.discordReaction.upsert({
        where: {
          proposalId_drepId_guildId_discordUserId: {
            proposalId,
            drepId,
            guildId,
            discordUserId,
          },
        },
        update: {
          sentiment: sentimentUpper,
          discordUsername: discordUsername || "Unknown",
          channelId,
        },
        create: {
          proposalId,
          drepId,
          guildId,
          channelId,
          discordUserId,
          discordUsername: discordUsername || "Unknown",
          sentiment: sentimentUpper,
        },
      });
    } else {
      // Remove reaction
      await prisma.discordReaction.deleteMany({
        where: {
          proposalId,
          drepId,
          guildId,
          discordUserId,
          sentiment: sentimentUpper,
        },
      });
    }

    // Update aggregated sentiment summary and get counts
    const voteCounts = await updateSentimentSummary(proposalId, drepId, guildId);

    return res.status(200).json({
      success: true,
      message: `Reaction ${action}ed successfully`,
      vote: {
        yes: voteCounts.yesCount,
        no: voteCounts.noCount,
        abstain: voteCounts.abstainCount,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error submitting reaction:", error);
    return res.status(500).json({
      error: "Failed to submit reaction",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update the aggregated sentiment summary for a proposal
 * Updates counts in GuildProposalPost and returns the updated counts
 */
async function updateSentimentSummary(
  proposalId: string,
  drepId: string,
  guildId: string
): Promise<{ yesCount: number; noCount: number; abstainCount: number; commentCount: number }> {
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

  return { yesCount, noCount, abstainCount, commentCount };
}
