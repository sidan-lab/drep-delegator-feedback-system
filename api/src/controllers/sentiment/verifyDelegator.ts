import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Verify a delegator and link their Discord account
 * Called from the delegator verification frontend
 */
export const verifyDelegator = async (req: Request, res: Response) => {
  try {
    const {
      drepId,
      discordUserId,
      discordUsername,
      stakeAddress,
      liveStake,
    } = req.body;

    // Validate required fields
    if (!drepId || !discordUserId || !stakeAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "drepId, discordUserId, and stakeAddress are required",
      });
    }

    // Check if DRep is registered and approved
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

    // Convert liveStake to BigInt if provided
    let liveStakeBigInt: bigint | null = null;
    if (liveStake) {
      try {
        liveStakeBigInt = BigInt(liveStake);
      } catch {
        // Ignore conversion errors
      }
    }

    // Upsert the verified delegator
    const delegator = await prisma.verifiedDelegator.upsert({
      where: {
        drepId_discordUserId: { drepId, discordUserId },
      },
      update: {
        discordUsername: discordUsername || "Unknown",
        stakeAddress,
        liveStake: liveStakeBigInt,
        isActive: true,
        deactivatedAt: null,
        deactivationReason: null,
        lastVerifiedAt: new Date(),
      },
      create: {
        drepId,
        discordUserId,
        discordUsername: discordUsername || "Unknown",
        stakeAddress,
        liveStake: liveStakeBigInt,
        isActive: true,
        lastVerifiedAt: new Date(),
      },
    });

    console.log(
      `[Sentiment] Delegator verified: ${discordUserId} for DRep ${drepId}`
    );

    return res.status(200).json({
      success: true,
      message: "Delegator verified successfully",
      delegator: {
        id: delegator.id,
        discordUserId: delegator.discordUserId,
        stakeAddress: delegator.stakeAddress,
        isActive: delegator.isActive,
      },
    });
  } catch (error: any) {
    // Handle unique constraint violation (same stake address for different Discord user)
    if (error.code === "P2002" && error.meta?.target?.includes("stakeAddress")) {
      return res.status(409).json({
        success: false,
        error: "Stake address already registered",
        message:
          "This stake address is already linked to another Discord account for this DRep",
      });
    }

    console.error("[Sentiment] Error verifying delegator:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify delegator",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Deactivate a delegator (called by DRep)
 */
export const deactivateDelegator = async (req: Request, res: Response) => {
  try {
    const { drepId, discordUserId, reason } = req.body;

    // Validate required fields
    if (!drepId || !discordUserId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "drepId and discordUserId are required",
      });
    }

    // Update the delegator
    const delegator = await prisma.verifiedDelegator.update({
      where: {
        drepId_discordUserId: { drepId, discordUserId },
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason || "Manually deactivated by DRep",
      },
    });

    console.log(
      `[Sentiment] Delegator deactivated: ${discordUserId} for DRep ${drepId}`
    );

    return res.status(200).json({
      success: true,
      message: "Delegator deactivated successfully",
      delegator: {
        id: delegator.id,
        discordUserId: delegator.discordUserId,
        isActive: delegator.isActive,
        deactivatedAt: delegator.deactivatedAt,
      },
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Delegator not found",
        message: "No verified delegator found with this Discord ID for this DRep",
      });
    }

    console.error("[Sentiment] Error deactivating delegator:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to deactivate delegator",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * List verified delegators for a DRep
 */
export const listDelegators = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.params;
    const { active, limit = "100", offset = "0" } = req.query;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing drepId",
        message: "drepId path parameter is required",
      });
    }

    // Build query
    const where: any = { drepId };
    if (active !== undefined) {
      where.isActive = active === "true";
    }

    // Get delegators with pagination
    const [delegators, total] = await Promise.all([
      prisma.verifiedDelegator.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 100, 500),
        skip: parseInt(offset as string) || 0,
        select: {
          id: true,
          discordUserId: true,
          discordUsername: true,
          stakeAddress: true,
          liveStake: true,
          isActive: true,
          deactivatedAt: true,
          deactivationReason: true,
          lastVerifiedAt: true,
          createdAt: true,
        },
      }),
      prisma.verifiedDelegator.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      drepId,
      delegators: delegators.map((d) => ({
        ...d,
        liveStake: d.liveStake?.toString() || null,
      })),
      pagination: {
        total,
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error listing delegators:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to list delegators",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
