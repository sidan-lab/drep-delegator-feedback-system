import { Request, Response } from "express";
import { prisma } from "../../services";
import { validateGuildId } from "../../middleware/auth.middleware";

/**
 * Create a record of a proposal posted to a Discord guild
 * Called by Discord bot after creating a forum thread
 */
export const createProposalPost = async (req: Request, res: Response) => {
  try {
    const { guildId, drepId, proposalId, threadId } = req.body;

    // Validate required fields
    if (!guildId || !drepId || !proposalId || !threadId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "guildId, drepId, proposalId, and threadId are required",
      });
    }

    // Validate guild ID matches registered Discord server for this DRep
    const guildValidation = validateGuildId(req, guildId);
    if (!guildValidation.valid) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized Discord server",
        message: guildValidation.error,
      });
    }

    // Verify DRep is approved
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        success: false,
        error: "DRep not registered",
        message: "This DRep is not registered for sentiment collection",
      });
    }

    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "DRep not approved",
        message: "This DRep's registration is pending approval",
      });
    }

    // Verify guild is registered for this DRep
    const guild = await prisma.discordGuild.findUnique({
      where: { guildId_drepId: { guildId, drepId } },
    });

    if (!guild) {
      return res.status(403).json({
        success: false,
        error: "Guild not registered",
        message: "This guild is not registered for this DRep",
      });
    }

    // Validate proposal exists in database (optional - can be skipped if allowing any proposalId)
    const proposal = await prisma.proposal.findUnique({
      where: { proposalId },
    });

    if (!proposal) {
      return res.status(400).json({
        success: false,
        error: "Proposal not found",
        message: "This proposal does not exist in the database",
      });
    }

    // Upsert the proposal post record
    const proposalPost = await prisma.guildProposalPost.upsert({
      where: {
        guildId_drepId_proposalId: { guildId, drepId, proposalId },
      },
      update: {
        threadId,
      },
      create: {
        guildId,
        drepId,
        proposalId,
        threadId,
      },
    });

    console.log(
      `[Sentiment] Proposal post created: ${proposalId} in guild ${guildId} for DRep ${drepId}`
    );

    return res.status(201).json({
      success: true,
      message: "Proposal post recorded successfully",
      proposalPost: {
        id: proposalPost.id,
        guildId: proposalPost.guildId,
        drepId: proposalPost.drepId,
        proposalId: proposalPost.proposalId,
        threadId: proposalPost.threadId,
        postedAt: proposalPost.postedAt,
      },
    });
  } catch (error: any) {
    console.error("[Sentiment] Error creating proposal post:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create proposal post",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get all proposal posts for a guild
 * Used by Discord bot to check which proposals have already been posted
 */
export const getProposalPosts = async (req: Request, res: Response) => {
  try {
    const { guildId, drepId } = req.params;

    if (!guildId || !drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "guildId and drepId path parameters are required",
      });
    }

    // Validate guild ID matches registered Discord server for this DRep
    const guildValidation = validateGuildId(req, guildId);
    if (!guildValidation.valid) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized Discord server",
        message: guildValidation.error,
      });
    }

    // Get all proposal posts for this guild
    const posts = await prisma.guildProposalPost.findMany({
      where: { guildId, drepId },
      orderBy: { postedAt: "desc" },
      select: {
        id: true,
        proposalId: true,
        threadId: true,
        postedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      guildId,
      drepId,
      posts,
      count: posts.length,
    });
  } catch (error) {
    console.error("[Sentiment] Error getting proposal posts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get proposal posts",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Check if a specific proposal has been posted to a guild
 * Used by Discord bot before posting to avoid duplicates
 */
export const checkProposalPost = async (req: Request, res: Response) => {
  try {
    const { guildId, drepId, proposalId } = req.query;

    if (!guildId || !drepId || !proposalId) {
      return res.status(400).json({
        success: false,
        posted: false,
        error: "Missing required parameters",
        message: "guildId, drepId, and proposalId query parameters are required",
      });
    }

    // Validate guild ID matches registered Discord server for this DRep
    const guildValidation = validateGuildId(req, guildId as string);
    if (!guildValidation.valid) {
      return res.status(403).json({
        success: false,
        posted: false,
        error: "Unauthorized Discord server",
        message: guildValidation.error,
      });
    }

    const post = await prisma.guildProposalPost.findUnique({
      where: {
        guildId_drepId_proposalId: {
          guildId: guildId as string,
          drepId: drepId as string,
          proposalId: proposalId as string,
        },
      },
      select: {
        id: true,
        threadId: true,
        postedAt: true,
      },
    });

    if (!post) {
      return res.status(200).json({
        success: true,
        posted: false,
        message: "Proposal has not been posted to this guild",
      });
    }

    return res.status(200).json({
      success: true,
      posted: true,
      message: "Proposal has been posted to this guild",
      post: {
        id: post.id,
        threadId: post.threadId,
        postedAt: post.postedAt,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error checking proposal post:", error);
    return res.status(500).json({
      success: false,
      posted: false,
      error: "Failed to check proposal post",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get proposal ID by thread ID
 * Used by Discord bot to look up proposalId for comment collection
 */
export const getProposalByThreadId = async (req: Request, res: Response) => {
  try {
    const { threadId, drepId } = req.query;

    if (!threadId || !drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        message: "threadId and drepId query parameters are required",
      });
    }

    // Find the proposal post by threadId
    const post = await prisma.guildProposalPost.findFirst({
      where: {
        threadId: threadId as string,
        drepId: drepId as string,
      },
      select: {
        proposalId: true,
        guildId: true,
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Thread not found",
        message: "No proposal post found for this thread",
        proposalId: null,
      });
    }

    return res.status(200).json({
      success: true,
      proposalId: post.proposalId,
      guildId: post.guildId,
    });
  } catch (error) {
    console.error("[Sentiment] Error getting proposal by thread ID:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get proposal",
      message: error instanceof Error ? error.message : "Unknown error",
      proposalId: null,
    });
  }
};

/**
 * Delete a proposal post record
 * Used if a forum thread is deleted manually
 */
export const deleteProposalPost = async (req: Request, res: Response) => {
  try {
    const { guildId, drepId, proposalId } = req.body;

    if (!guildId || !drepId || !proposalId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "guildId, drepId, and proposalId are required",
      });
    }

    // Validate guild ID matches registered Discord server for this DRep
    const guildValidation = validateGuildId(req, guildId);
    if (!guildValidation.valid) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized Discord server",
        message: guildValidation.error,
      });
    }

    const deleted = await prisma.guildProposalPost.delete({
      where: {
        guildId_drepId_proposalId: { guildId, drepId, proposalId },
      },
    });

    console.log(
      `[Sentiment] Proposal post deleted: ${proposalId} from guild ${guildId}`
    );

    return res.status(200).json({
      success: true,
      message: "Proposal post deleted successfully",
      deleted: {
        id: deleted.id,
        proposalId: deleted.proposalId,
      },
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Proposal post not found",
        message: "No proposal post found with these parameters",
      });
    }

    console.error("[Sentiment] Error deleting proposal post:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete proposal post",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
