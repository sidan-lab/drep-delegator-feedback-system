import { Request, Response } from "express";
import { SentimentType } from "@prisma/client";
import { prisma } from "../../services";

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

    // Create comment (messageId is unique, so duplicates will fail)
    try {
      await prisma.discordComment.create({
        data: {
          proposalId,
          drepId,
          guildId,
          channelId,
          discordUserId,
          discordUsername: discordUsername || "Unknown",
          messageId,
          content,
          sentiment: sentimentUpper,
        },
      });
    } catch (error: any) {
      // Handle duplicate messageId
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Duplicate comment",
          message: "This message has already been recorded",
        });
      }
      throw error;
    }

    // Update aggregated sentiment summary
    await updateSentimentSummary(proposalId, drepId);

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
