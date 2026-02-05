import { Request, Response } from "express";
import { prisma } from "../../services";
import { getStringParam } from "../../utils/requestHelpers";

/**
 * Publish or update a draft vote intent
 * Allows DReps to share their preliminary voting position before casting on-chain vote
 */
export const publishDraftVote = async (req: Request, res: Response) => {
  try {
    const { proposalId, vote, rationaleUrl } = req.body;

    // Get authenticated user from JWT middleware
    const user = (req as any).user;
    if (!user || !user.id || !user.walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required. Please connect your wallet and sign in.",
      });
    }

    // Validate required fields
    if (!proposalId || !vote) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "proposalId and vote are required",
      });
    }

    // Validate vote value
    const voteUpper = vote.toUpperCase();
    if (!["YES", "NO", "ABSTAIN"].includes(voteUpper)) {
      return res.status(400).json({
        success: false,
        error: "Invalid vote value",
        message: "vote must be YES, NO, or ABSTAIN",
      });
    }

    // Find DRep registration for this user
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { userId: user.id },
      select: {
        drepId: true,
        status: true,
        discordGuildId: true,
      },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        success: false,
        error: "DRep not registered",
        message: "You must be a registered DRep to publish draft votes",
      });
    }

    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "DRep not approved",
        message: "Your DRep registration is pending approval",
      });
    }

    const drepId = drepRegistration.drepId;

    // Note: DReps CAN publish drafts even after voting on-chain
    // This allows them to signal they're reconsidering their vote and get delegator feedback
    // before submitting a new on-chain vote

    // Check if proposal has been posted to Discord
    const proposalPost = await prisma.guildProposalPost.findFirst({
      where: {
        proposalId,
        drepId,
      },
    });

    if (!proposalPost) {
      return res.status(400).json({
        success: false,
        error: "Proposal not posted",
        message: "This proposal must be posted to your Discord server before you can publish a draft vote",
      });
    }

    // Upsert the draft vote (create or update)
    const updatedPost = await prisma.guildProposalPost.update({
      where: {
        id: proposalPost.id,
      },
      data: {
        isDraft: true,
        drepVote: voteUpper as "YES" | "NO" | "ABSTAIN",
        drepRationaleUrl: rationaleUrl || null,
        draftPublishedAt: proposalPost.isDraft ? proposalPost.draftPublishedAt : new Date(),
        drepVoteTxHash: null,
        drepVotedAt: null,
        discordNotifiedAt: null, // Reset to trigger Discord notification
      },
    });

    console.log(
      `[Draft Vote] ${proposalPost.isDraft ? "Updated" : "Published"} draft: ${drepId} voted ${voteUpper} on ${proposalId}`
    );

    return res.status(200).json({
      success: true,
      message: proposalPost.isDraft ? "Draft vote updated successfully" : "Draft vote published successfully",
      draft: {
        proposalId: updatedPost.proposalId,
        vote: updatedPost.drepVote,
        rationaleUrl: updatedPost.drepRationaleUrl,
        publishedAt: updatedPost.draftPublishedAt,
        sentiment: {
          yesCount: updatedPost.yesCount,
          noCount: updatedPost.noCount,
          abstainCount: updatedPost.abstainCount,
          commentCount: updatedPost.commentCount,
        },
      },
    });
  } catch (error) {
    console.error("[Draft Vote] Error publishing draft vote:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to publish draft vote",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a draft vote intent
 * Removes the draft and allows DRep to start fresh
 */
export const deleteDraftVote = async (req: Request, res: Response) => {
  try {
    const proposalId = getStringParam(req.params.proposalId);

    // Get authenticated user from JWT middleware
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter",
        message: "proposalId is required",
      });
    }

    // Find DRep registration for this user
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { userId: user.id },
      select: { drepId: true, status: true },
    });

    if (!drepRegistration || drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "You must be an approved DRep to delete draft votes",
      });
    }

    const drepId = drepRegistration.drepId;

    // Find the draft
    const proposalPost = await prisma.guildProposalPost.findFirst({
      where: {
        proposalId,
        drepId,
        isDraft: true,
      },
    });

    if (!proposalPost) {
      return res.status(404).json({
        success: false,
        error: "Draft not found",
        message: "No draft vote found for this proposal",
      });
    }

    // Clear draft fields
    await prisma.guildProposalPost.update({
      where: { id: proposalPost.id },
      data: {
        isDraft: false,
        drepVote: null,
        drepRationaleUrl: null,
        draftPublishedAt: null,
        discordNotifiedAt: null, // Reset to trigger Discord notification of removal
      },
    });

    console.log(`[Draft Vote] Deleted draft: ${drepId} on ${proposalId}`);

    return res.status(200).json({
      success: true,
      message: "Draft vote deleted successfully",
    });
  } catch (error) {
    console.error("[Draft Vote] Error deleting draft vote:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete draft vote",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get a single draft vote for a proposal
 * Used by frontend to check if DRep has published a draft
 */
export const getDraftVote = async (req: Request, res: Response) => {
  try {
    const proposalId = getStringParam(req.params.proposalId);

    // Get authenticated user from JWT middleware
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter",
        message: "proposalId is required",
      });
    }

    // Find DRep registration for this user
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { userId: user.id },
      select: { drepId: true },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "You must be a registered DRep",
      });
    }

    const drepId = drepRegistration.drepId;

    // Find the draft
    const proposalPost = await prisma.guildProposalPost.findFirst({
      where: {
        proposalId,
        drepId,
        isDraft: true,
      },
    });

    if (!proposalPost) {
      return res.status(200).json({
        success: true,
        hasDraft: false,
        draft: null,
      });
    }

    return res.status(200).json({
      success: true,
      hasDraft: true,
      draft: {
        proposalId: proposalPost.proposalId,
        vote: proposalPost.drepVote,
        rationaleUrl: proposalPost.drepRationaleUrl,
        publishedAt: proposalPost.draftPublishedAt,
        sentiment: {
          yesCount: proposalPost.yesCount,
          noCount: proposalPost.noCount,
          abstainCount: proposalPost.abstainCount,
          commentCount: proposalPost.commentCount,
        },
      },
    });
  } catch (error) {
    console.error("[Draft Vote] Error getting draft vote:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get draft vote",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get all draft votes for the authenticated DRep
 * Used by DRep dashboard to show all pending drafts
 */
export const getDraftVotes = async (req: Request, res: Response) => {
  try {
    // Get authenticated user from JWT middleware
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    // Find DRep registration for this user
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { userId: user.id },
      select: { drepId: true },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "You must be a registered DRep",
      });
    }

    const drepId = drepRegistration.drepId;

    // Get all drafts for this DRep
    const drafts = await prisma.guildProposalPost.findMany({
      where: {
        drepId,
        isDraft: true,
      },
      orderBy: {
        draftPublishedAt: "desc",
      },
    });

    const draftList = drafts.map((post) => ({
      proposalId: post.proposalId,
      vote: post.drepVote,
      rationaleUrl: post.drepRationaleUrl,
      publishedAt: post.draftPublishedAt,
      sentiment: {
        yesCount: post.yesCount,
        noCount: post.noCount,
        abstainCount: post.abstainCount,
        commentCount: post.commentCount,
      },
    }));

    return res.status(200).json({
      success: true,
      drafts: draftList,
      count: draftList.length,
    });
  } catch (error) {
    console.error("[Draft Vote] Error getting draft votes:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get draft votes",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
