import { Request, Response } from "express";
import { prisma } from "../../services";
import { checkStakeAddressDelegation } from "../../services/koios";

/**
 * Verify a delegator and link their Discord account
 * Combines delegation check + saving in one step
 * Called from the delegator verification frontend
 */
export const verifyDelegator = async (req: Request, res: Response) => {
  try {
    const {
      drepId,
      discordUserId,
      discordUsername,
      stakeAddress,
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

    // Check delegation status via Koios
    const delegationStatus = await checkStakeAddressDelegation(stakeAddress);

    if (!delegationStatus.isRegistered) {
      return res.status(400).json({
        success: false,
        error: "Stake address not registered",
        message: "This stake address is not registered on-chain",
        delegation: delegationStatus,
      });
    }

    if (!delegationStatus.isDRepDelegated) {
      return res.status(400).json({
        success: false,
        error: "Not delegated to any DRep",
        message: "This stake address is not delegated to any DRep",
        delegation: delegationStatus,
      });
    }

    if (delegationStatus.delegatedDRepId !== drepId) {
      return res.status(400).json({
        success: false,
        error: "Delegated to different DRep",
        message: `This stake address is delegated to a different DRep: ${delegationStatus.delegatedDRepId}`,
        delegation: delegationStatus,
      });
    }

    // Convert balance to BigInt
    let liveStakeBigInt: bigint | null = null;
    if (delegationStatus.totalBalance) {
      try {
        liveStakeBigInt = BigInt(delegationStatus.totalBalance);
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
        liveStake: liveStakeBigInt?.toString() || null,
        isActive: delegator.isActive,
      },
      delegation: delegationStatus,
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
 * Check if a specific Discord user is a verified delegator
 * Used by Discord bot to confirm verification status
 */
export const checkDelegator = async (req: Request, res: Response) => {
  try {
    const { drepId, discordUserId } = req.query;

    if (!drepId || !discordUserId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing required parameters",
        message: "drepId and discordUserId query parameters are required",
      });
    }

    // Find the delegator
    const delegator = await prisma.verifiedDelegator.findUnique({
      where: {
        drepId_discordUserId: {
          drepId: drepId as string,
          discordUserId: discordUserId as string,
        },
      },
      select: {
        id: true,
        discordUserId: true,
        discordUsername: true,
        stakeAddress: true,
        liveStake: true,
        isActive: true,
        lastVerifiedAt: true,
      },
    });

    if (!delegator) {
      return res.status(200).json({
        success: true,
        verified: false,
        message: "Delegator not found",
      });
    }

    if (!delegator.isActive) {
      return res.status(200).json({
        success: true,
        verified: false,
        message: "Delegator is deactivated",
        delegator: {
          discordUserId: delegator.discordUserId,
          isActive: delegator.isActive,
        },
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Delegator is verified",
      delegator: {
        id: delegator.id,
        discordUserId: delegator.discordUserId,
        discordUsername: delegator.discordUsername,
        stakeAddress: delegator.stakeAddress,
        liveStake: delegator.liveStake?.toString() || null,
        isActive: delegator.isActive,
        lastVerifiedAt: delegator.lastVerifiedAt,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error checking delegator:", error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: "Failed to check delegator",
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
