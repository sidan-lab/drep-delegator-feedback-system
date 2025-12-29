import { Request, Response } from "express";
import { prisma } from "../../services";
import { normalizeToCip129 } from "../../libs/drepIdConverter";

/**
 * Resolve proposal identifier to the canonical proposalId
 * Handles both gov_action (bech32) and txHash:certIndex formats
 */
async function resolveProposalId(inputId: string): Promise<string> {
  // First, try to find by proposalId (gov_action format)
  const byProposalId = await prisma.proposal.findUnique({
    where: { proposalId: inputId },
    select: { proposalId: true },
  });
  if (byProposalId) return byProposalId.proposalId;

  // If not found, try to find by txHash:certIndex
  if (inputId.includes(":")) {
    const [txHash, certIndex] = inputId.split(":");
    const byHash = await prisma.proposal.findFirst({
      where: { txHash, certIndex },
      select: { proposalId: true },
    });
    if (byHash) return byHash.proposalId;
  }

  // Return the input as-is if no match found (for backwards compatibility)
  return inputId;
}

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

    // Resolve to canonical proposalId (handles both gov_action and txHash:certIndex formats)
    const proposalId = await resolveProposalId(proposal_id);

    // Build query based on whether drepId is specified
    // Normalize drepId to CIP-129 format (wallet may send CIP-105)
    const where: any = { proposalId };
    if (drepId) {
      where.drepId = normalizeToCip129(drepId as string);
    }

    // Get sentiment summaries from GuildProposalPost (combined with proposal post tracking)
    const summaries = await prisma.guildProposalPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    if (summaries.length === 0) {
      return res.status(200).json({
        proposalId,
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
      proposalId,
      sentiment: summaries.map((s) => ({
        drepId: s.drepId,
        yesCount: s.yesCount,
        noCount: s.noCount,
        abstainCount: s.abstainCount,
        commentCount: s.commentCount,
        lastUpdated: s.updatedAt,
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
 * Now queries reactions that have comments (comment IS NOT NULL)
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

    // Resolve to canonical proposalId (handles both gov_action and txHash:certIndex formats)
    const proposalId = await resolveProposalId(proposal_id);

    // Build query - only get reactions with comments
    // Normalize drepId to CIP-129 format (wallet may send CIP-105)
    const where: any = { proposalId, comment: { not: null } };
    if (drepId) {
      where.drepId = normalizeToCip129(drepId as string);
    }

    // Get reactions with comments (pagination)
    const [reactions, total] = await Promise.all([
      prisma.discordReaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 50, 100),
        skip: parseInt(offset as string) || 0,
        select: {
          id: true,
          proposalId: true,
          drepId: true,
          discordUsername: true,
          comment: true,
          sentiment: true,
          createdAt: true,
        },
      }),
      prisma.discordReaction.count({ where }),
    ]);

    // Map to expected comment format (content -> comment for backwards compatibility)
    const comments = reactions.map((r) => ({
      id: r.id,
      proposalId: r.proposalId,
      drepId: r.drepId,
      discordUsername: r.discordUsername,
      content: r.comment, // Map comment to content for API compatibility
      sentiment: r.sentiment,
      createdAt: r.createdAt,
    }));

    return res.status(200).json({
      proposalId,
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
 * Includes delegator info (stakeAddress, liveStake) when available
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

    // Resolve to canonical proposalId (handles both gov_action and txHash:certIndex formats)
    const proposalId = await resolveProposalId(proposal_id);

    // Build query
    // Normalize drepId to CIP-129 format (wallet may send CIP-105)
    const where: any = { proposalId };
    if (drepId) {
      where.drepId = normalizeToCip129(drepId as string);
    }
    if (sentiment) {
      where.sentiment = (sentiment as string).toUpperCase();
    }

    // Get reactions with pagination and include verified delegator info
    const [reactions, total] = await Promise.all([
      prisma.discordReaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 100, 500),
        skip: parseInt(offset as string) || 0,
        include: {
          delegator: {
            select: {
              stakeAddress: true,
              liveStake: true,
            },
          },
        },
      }),
      prisma.discordReaction.count({ where }),
    ]);

    // Flatten the response to include stakeAddress, liveStake, and comment at top level
    const flattenedReactions = reactions.map((r) => ({
      id: r.id,
      proposalId: r.proposalId,
      drepId: r.drepId,
      discordUserId: r.discordUserId,
      discordUsername: r.discordUsername,
      sentiment: r.sentiment,
      comment: r.comment || null,
      createdAt: r.createdAt,
      stakeAddress: r.delegator?.stakeAddress || null,
      liveStake: r.delegator?.liveStake?.toString() || null,
    }));

    return res.status(200).json({
      proposalId,
      reactions: flattenedReactions,
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
