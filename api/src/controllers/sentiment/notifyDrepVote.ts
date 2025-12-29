import { Request, Response } from "express";
import { VoteType } from "@prisma/client";
import { prisma } from "../../services";
import { normalizeToCip129 } from "../../libs/drepIdConverter";

/**
 * Notify that a DRep has voted on-chain (called from frontend after voting)
 * This updates the GuildProposalPost record to trigger Discord notification
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const notifyDrepVote = async (req: Request, res: Response) => {
  try {
    const { drepId, proposalId, vote, txHash, rationaleUrl } = req.body;

    // Validate required fields
    if (!proposalId || !vote || !txHash) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "proposalId, vote, and txHash are required",
      });
    }

    // Validate vote type
    const voteUpper = vote.toUpperCase() as VoteType;
    if (!["YES", "NO", "ABSTAIN"].includes(voteUpper)) {
      return res.status(400).json({
        error: "Invalid vote",
        message: "vote must be 'Yes', 'No', or 'Abstain'",
      });
    }

    // Get DRep info from JWT user (attached by jwtAuth middleware)
    const userDrepRegistration = req.user?.drepRegistration;

    // If drepId is provided in body, normalize it; otherwise use from JWT
    let normalizedDrepId: string;
    if (drepId) {
      normalizedDrepId = normalizeToCip129(drepId);
    } else if (userDrepRegistration?.drepId) {
      normalizedDrepId = userDrepRegistration.drepId;
    } else {
      return res.status(403).json({
        error: "DRep not authorized",
        message: "No DRep ID found. Please register as a DRep first.",
      });
    }

    // Verify DRep is registered and approved
    const drepRegistration = userDrepRegistration?.drepId === normalizedDrepId
      ? userDrepRegistration
      : await prisma.drepRegistration.findUnique({
          where: { drepId: normalizedDrepId },
        });

    if (!drepRegistration || drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        error: "DRep not authorized",
        message: "This DRep is not registered or not approved for Discord notifications",
      });
    }

    // Find GuildProposalPost for this DRep and proposal
    const proposalPost = await prisma.guildProposalPost.findFirst({
      where: {
        drepId: normalizedDrepId,
        proposalId,
      },
    });

    if (!proposalPost) {
      // No Discord post exists for this proposal - this is okay, just return success
      // The DRep may not have posted this proposal to Discord yet
      return res.status(200).json({
        success: true,
        message: "Vote recorded but no Discord post exists for this proposal",
        discordNotificationPending: false,
      });
    }

    // Update GuildProposalPost with DRep vote info and clear discordNotifiedAt
    await prisma.guildProposalPost.update({
      where: { id: proposalPost.id },
      data: {
        drepVote: voteUpper,
        drepRationaleUrl: rationaleUrl || null,
        drepVoteTxHash: txHash,
        drepVotedAt: new Date(),
        discordNotifiedAt: null, // Clear to trigger Discord bot notification
      },
    });

    return res.status(200).json({
      success: true,
      message: "DRep vote notification recorded",
      discordNotificationPending: true,
      threadId: proposalPost.threadId,
    });
  } catch (error) {
    console.error("[Sentiment] Error notifying DRep vote:", error);
    return res.status(500).json({
      error: "Failed to notify DRep vote",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get pending DRep vote notifications for Discord bot
 * Returns GuildProposalPosts where drepVote is set but discordNotifiedAt is null
 */
export const getPendingDrepVoteNotifications = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.query;

    // Build query
    const where: any = {
      drepVote: { not: null },
      discordNotifiedAt: null,
    };

    // If drepId provided, filter by it
    if (drepId) {
      where.drepId = normalizeToCip129(drepId as string);
    }

    // Get pending notifications
    const pendingNotifications = await prisma.guildProposalPost.findMany({
      where,
      select: {
        id: true,
        guildId: true,
        drepId: true,
        proposalId: true,
        threadId: true,
        drepVote: true,
        drepRationaleUrl: true,
        drepVoteTxHash: true,
        drepVotedAt: true,
      },
      orderBy: { drepVotedAt: "asc" },
    });

    return res.status(200).json({
      success: true,
      notifications: pendingNotifications,
      count: pendingNotifications.length,
    });
  } catch (error) {
    console.error("[Sentiment] Error getting pending DRep vote notifications:", error);
    return res.status(500).json({
      error: "Failed to get pending notifications",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Mark a DRep vote notification as sent to Discord
 * Called by Discord bot after successfully updating the forum thread
 */
export const markDrepVoteNotified = async (req: Request, res: Response) => {
  try {
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        error: "Missing required field",
        message: "postId is required",
      });
    }

    // Update the record to mark as notified
    const updated = await prisma.guildProposalPost.update({
      where: { id: postId },
      data: {
        discordNotifiedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as sent",
      postId: updated.id,
    });
  } catch (error) {
    console.error("[Sentiment] Error marking DRep vote notified:", error);
    return res.status(500).json({
      error: "Failed to mark notification as sent",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
