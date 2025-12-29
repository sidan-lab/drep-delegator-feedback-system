import { Request, Response } from "express";
import { prisma } from "../../services";
import { generateApiKey } from "../../libs/apiKey";
import { verifyDrepOwnership } from "../../libs/drepVerification";

/**
 * Register a new DRep for sentiment collection
 * Requires JWT authentication and verifies DRep ownership
 * Status will be PENDING until approved by admin
 */
export const registerDrep = async (req: Request, res: Response) => {
  try {
    const { drepId, drepName, contactEmail, discordGuildId } = req.body;

    // Get authenticated user from JWT middleware
    const user = (req as any).user;
    if (!user || !user.id || !user.walletAddress) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required. Please connect your wallet and sign in.",
      });
    }

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    if (!discordGuildId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "discordGuildId is required. Please provide your Discord server ID.",
      });
    }

    // Basic validation for Discord guild ID (snowflake format - 17-19 digit number)
    if (!/^\d{17,19}$/.test(discordGuildId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Discord Guild ID",
        message: "Discord Guild ID must be a valid snowflake (17-19 digit number)",
      });
    }

    // Verify DRep ownership - user's wallet must own the DRep
    const verification = await verifyDrepOwnership(user.walletAddress, drepId);

    if (!verification.verified) {
      return res.status(403).json({
        success: false,
        error: "DRep ownership verification failed",
        message: verification.error,
        isScriptBased: verification.isScriptBased || false,
      });
    }

    // Check if DRep is already registered
    const existing = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Already registered",
        message: "This DRep is already registered",
        data: {
          drepId: existing.drepId,
          status: existing.status,
        },
      });
    }

    // Check if user already has a registration
    const userExisting = await prisma.drepRegistration.findUnique({
      where: { userId: user.id },
    });

    if (userExisting) {
      return res.status(409).json({
        success: false,
        error: "User already has registration",
        message: "You already have a DRep registration. Each wallet can only register one DRep.",
        data: {
          drepId: userExisting.drepId,
          status: userExisting.status,
        },
      });
    }

    // Create registration linked to the user
    const registration = await prisma.drepRegistration.create({
      data: {
        drepId,
        drepName: drepName || null,
        contactEmail: contactEmail || null,
        discordGuildId,
        userId: user.id,
        status: "PENDING",
      },
    });

    console.log(`[DRep] New verified registration: ${drepId} by user ${user.id} for guild ${discordGuildId}`);

    return res.status(201).json({
      success: true,
      message: "DRep registration submitted. Your ownership has been verified. Pending admin approval.",
      data: {
        id: registration.id,
        drepId: registration.drepId,
        drepName: registration.drepName,
        discordGuildId: registration.discordGuildId,
        status: registration.status,
      },
    });
  } catch (error) {
    console.error("[DRep] Error registering DRep:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to register DRep",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Approve a DRep registration and generate API key
 * Admin-only endpoint
 */
export const approveDrep = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.params;
    const { rationale } = req.body;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    // Find the registration
    const registration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "DRep registration not found",
      });
    }

    if (registration.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Already approved",
        message: "This DRep is already approved",
        data: {
          drepId: registration.drepId,
          // Don't expose API key in error response
        },
      });
    }

    // Generate API key and approve
    const apiKey = generateApiKey();

    const updated = await prisma.drepRegistration.update({
      where: { drepId },
      data: {
        status: "APPROVED",
        apiKey,
        rationale: rationale || null,
        reviewedAt: new Date(),
      },
    });

    console.log(`[DRep] Approved: ${drepId}`);

    return res.status(200).json({
      success: true,
      message: "DRep approved successfully. API key generated.",
      data: {
        id: updated.id,
        drepId: updated.drepId,
        drepName: updated.drepName,
        status: updated.status,
        apiKey: updated.apiKey, // Return API key only on approval
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error("[DRep] Error approving DRep:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to approve DRep",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Reject a DRep registration (or revoke an approved one)
 * Admin-only endpoint
 */
export const rejectDrep = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.params;
    const { rationale } = req.body;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    // Find the registration
    const registration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "DRep registration not found",
      });
    }

    const updated = await prisma.drepRegistration.update({
      where: { drepId },
      data: {
        status: "REJECTED",
        rationale: rationale || "No reason provided",
        reviewedAt: new Date(),
        apiKey: null, // Clear any existing API key
      },
    });

    console.log(`[DRep] Rejected: ${drepId} - ${rationale}`);

    return res.status(200).json({
      success: true,
      message: "DRep registration rejected",
      data: {
        id: updated.id,
        drepId: updated.drepId,
        status: updated.status,
        rationale: updated.rationale,
      },
    });
  } catch (error) {
    console.error("[DRep] Error rejecting DRep:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reject DRep",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Regenerate API key for an approved DRep
 * Use this if the API key is compromised
 */
export const regenerateApiKey = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.params;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    // Find the registration
    const registration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "DRep registration not found",
      });
    }

    if (registration.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Not approved",
        message: "Can only regenerate API key for approved DReps",
      });
    }

    // Generate new API key
    const apiKey = generateApiKey();

    const updated = await prisma.drepRegistration.update({
      where: { drepId },
      data: { apiKey },
    });

    console.log(`[DRep] API key regenerated: ${drepId}`);

    return res.status(200).json({
      success: true,
      message: "API key regenerated successfully",
      data: {
        drepId: updated.drepId,
        apiKey: updated.apiKey,
      },
    });
  } catch (error) {
    console.error("[DRep] Error regenerating API key:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to regenerate API key",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get DRep registration status (public)
 */
export const getDrepStatus = async (req: Request, res: Response) => {
  try {
    const { drepId } = req.params;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    const registration = await prisma.drepRegistration.findUnique({
      where: { drepId },
      select: {
        id: true,
        drepId: true,
        drepName: true,
        discordGuildId: true,
        status: true,
        rationale: true,
        reviewedAt: true,
        createdAt: true,
        // Don't expose apiKey, contactEmail
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "DRep registration not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: registration,
    });
  } catch (error) {
    console.error("[DRep] Error getting DRep status:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get DRep status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * List all DRep registrations (admin)
 */
export const listDrepRegistrations = async (req: Request, res: Response) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [registrations, total] = await Promise.all([
      prisma.drepRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit as string) || 50, 100),
        skip: parseInt(offset as string) || 0,
        select: {
          id: true,
          drepId: true,
          drepName: true,
          contactEmail: true,
          discordGuildId: true,
          status: true,
          rationale: true,
          reviewedAt: true,
          createdAt: true,
          // Don't expose apiKey in list
        },
      }),
      prisma.drepRegistration.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: registrations,
      pagination: {
        total,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error("[DRep] Error listing registrations:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to list registrations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
