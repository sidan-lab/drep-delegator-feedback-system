import { Request, Response } from "express";
import { SentimentType } from "@prisma/client";
import { prisma } from "../../services";

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

    // Update aggregated sentiment summary
    await updateSentimentSummary(proposalId, drepId);

    return res.status(200).json({
      success: true,
      message: `Reaction ${action}ed successfully`,
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
 */
async function updateSentimentSummary(
  proposalId: string,
  drepId: string
): Promise<void> {
  // Count reactions by sentiment
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
    prisma.discordComment.count({
      where: { proposalId, drepId },
    }),
  ]);

  // Upsert summary
  await prisma.proposalSentiment.upsert({
    where: {
      proposalId_drepId: { proposalId, drepId },
    },
    update: {
      yesCount,
      noCount,
      abstainCount,
      commentCount,
    },
    create: {
      proposalId,
      drepId,
      yesCount,
      noCount,
      abstainCount,
      commentCount,
    },
  });
}
