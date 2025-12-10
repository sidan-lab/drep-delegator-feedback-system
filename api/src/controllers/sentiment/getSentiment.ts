import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Get sentiment summary for a proposal
 * Used by frontend to display community feedback
 */
export const getSentiment = async (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.params;
    const { drepId } = req.query;

    if (!proposal_id) {
      return res.status(400).json({
        error: "Missing proposal_id",
        message: "proposal_id path parameter is required",
      });
    }

    // Build query based on whether drepId is specified
    const where: any = { proposalId: proposal_id };
    if (drepId) {
      where.drepId = drepId as string;
    }

    // Get sentiment summaries
    const summaries = await prisma.proposalSentiment.findMany({
      where,
      orderBy: { lastUpdated: "desc" },
    });

    if (summaries.length === 0) {
      return res.status(200).json({
        proposalId: proposal_id,
        sentiment: [],
        totals: {
          yesCount: 0,
          noCount: 0,
          abstainCount: 0,
          commentCount: 0,
          totalReactions: 0,
        },
      });
    }

    // Calculate totals across all DReps (if no specific drepId)
    const totals = summaries.reduce(
      (acc, s) => ({
        yesCount: acc.yesCount + s.yesCount,
        noCount: acc.noCount + s.noCount,
        abstainCount: acc.abstainCount + s.abstainCount,
        commentCount: acc.commentCount + s.commentCount,
      }),
      { yesCount: 0, noCount: 0, abstainCount: 0, commentCount: 0 }
    );

    return res.status(200).json({
      proposalId: proposal_id,
      sentiment: summaries.map((s) => ({
        drepId: s.drepId,
        yesCount: s.yesCount,
        noCount: s.noCount,
        abstainCount: s.abstainCount,
        commentCount: s.commentCount,
        lastUpdated: s.lastUpdated,
      })),
      totals: {
        ...totals,
        totalReactions: totals.yesCount + totals.noCount + totals.abstainCount,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error getting sentiment:", error);
    return res.status(500).json({
      error: "Failed to get sentiment",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get comments for a proposal
 * Used by frontend to display community feedback details
 */
export const getComments = async (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.params;
    const { drepId, limit = "50", offset = "0" } = req.query;

    if (!proposal_id) {
      return res.status(400).json({
        error: "Missing proposal_id",
        message: "proposal_id path parameter is required",
      });
    }

    // Build query
    const where: any = { proposalId: proposal_id };
    if (drepId) {
      where.drepId = drepId as string;
    }

    // Get comments with pagination
    const [comments, total] = await Promise.all([
      prisma.discordComment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 50, 100),
        skip: parseInt(offset as string) || 0,
        select: {
          id: true,
          proposalId: true,
          drepId: true,
          discordUsername: true,
          content: true,
          sentiment: true,
          createdAt: true,
        },
      }),
      prisma.discordComment.count({ where }),
    ]);

    return res.status(200).json({
      proposalId: proposal_id,
      comments,
      pagination: {
        total,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error getting comments:", error);
    return res.status(500).json({
      error: "Failed to get comments",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get individual reactions for a proposal (for detailed breakdown)
 */
export const getReactions = async (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.params;
    const { drepId, sentiment, limit = "100", offset = "0" } = req.query;

    if (!proposal_id) {
      return res.status(400).json({
        error: "Missing proposal_id",
        message: "proposal_id path parameter is required",
      });
    }

    // Build query
    const where: any = { proposalId: proposal_id };
    if (drepId) {
      where.drepId = drepId as string;
    }
    if (sentiment) {
      where.sentiment = (sentiment as string).toUpperCase();
    }

    // Get reactions with pagination
    const [reactions, total] = await Promise.all([
      prisma.discordReaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 100, 500),
        skip: parseInt(offset as string) || 0,
        select: {
          id: true,
          proposalId: true,
          drepId: true,
          discordUsername: true,
          sentiment: true,
          createdAt: true,
        },
      }),
      prisma.discordReaction.count({ where }),
    ]);

    return res.status(200).json({
      proposalId: proposal_id,
      reactions,
      pagination: {
        total,
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error getting reactions:", error);
    return res.status(500).json({
      error: "Failed to get reactions",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
