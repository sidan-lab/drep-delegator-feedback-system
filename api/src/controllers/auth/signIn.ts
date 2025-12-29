import { Request, Response } from "express";
import { checkSignature } from "@meshsdk/core";
import { prisma } from "../../services";
import { generateJWT } from "../../libs/jwt";
import { generateApiKey } from "../../libs/apiKey";

/**
 * Sign in with wallet signature verification
 * Verifies the wallet signature to prove ownership before creating JWT
 */
export const signIn = async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, nonce } = req.body;

    if (!walletAddress || !signature || !nonce) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "walletAddress, signature, and nonce are required",
      });
    }

    // Verify the signature using MeshSDK
    // checkSignature(nonce, signature) - only 2 params needed
    // The signature object contains { signature, key } from wallet.signData
    const isValid = checkSignature(nonce, signature);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid signature",
        message: "Wallet signature verification failed",
      });
    }

    // Find or create user by wallet address
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        drepRegistration: {
          select: {
            id: true,
            drepId: true,
            drepName: true,
            status: true,
          },
        },
      },
    });

    let isFirstTime = false;
    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: { walletAddress },
        include: {
          drepRegistration: {
            select: {
              id: true,
              drepId: true,
              drepName: true,
              status: true,
            },
          },
        },
      });
      isFirstTime = true;
    }

    // Generate JWT
    const jwt = generateJWT(
      user.id,
      walletAddress,
      user.drepRegistration?.drepName || undefined
    );

    // Update user's JWT in database (for session tracking)
    await prisma.user.update({
      where: { id: user.id },
      data: { jwt },
    });

    console.log(`[Auth] User signed in with verified signature: ${walletAddress} (isFirstTime: ${isFirstTime})`);

    return res.status(200).json({
      success: true,
      message: "Sign in successful",
      data: {
        userId: user.id,
        token: jwt,
        isFirstTime,
        drepRegistration: user.drepRegistration,
      },
    });
  } catch (error) {
    console.error("[Auth] Sign in error:", error);
    return res.status(500).json({
      success: false,
      error: "Sign in failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Claim a DRep registration
 * Links the authenticated user to a DrepRegistration
 * User must be authenticated via JWT
 */
export const claimDrep = async (req: Request, res: Response) => {
  try {
    const user = req.user; // Set by JWT middleware
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    const { drepId } = req.body;

    if (!drepId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field",
        message: "drepId is required",
      });
    }

    // Check if user already has a DRep registration linked
    if (user.drepRegistration) {
      return res.status(400).json({
        success: false,
        error: "Already claimed",
        message: "You already have a DRep registration linked to your account",
        data: {
          drepId: user.drepRegistration.drepId,
        },
      });
    }

    // Find the DRep registration
    const registration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "DRep registration not found. Please register first.",
      });
    }

    if (registration.userId) {
      return res.status(400).json({
        success: false,
        error: "Already claimed",
        message: "This DRep registration is already linked to another account",
      });
    }

    // Link the registration to the user
    const updated = await prisma.drepRegistration.update({
      where: { drepId },
      data: { userId: user.id },
      select: {
        id: true,
        drepId: true,
        drepName: true,
        status: true,
        apiKey: registration.status === "APPROVED" ? true : false, // Only indicate if has apiKey
      },
    });

    console.log(`[Auth] DRep claimed: ${drepId} by user ${user.id}`);

    return res.status(200).json({
      success: true,
      message: "DRep registration claimed successfully",
      data: {
        drepId: updated.drepId,
        drepName: updated.drepName,
        status: updated.status,
        hasApiKey: updated.apiKey,
      },
    });
  } catch (error) {
    console.error("[Auth] Claim DRep error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to claim DRep",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get current user profile
 * Returns user info and linked DRep registration
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        walletAddress: user.walletAddress,
        drepRegistration: user.drepRegistration
          ? {
              id: user.drepRegistration.id,
              drepId: user.drepRegistration.drepId,
              drepName: user.drepRegistration.drepName,
              status: user.drepRegistration.status,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[Auth] Get me error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get user",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get DRep API key (only for linked and approved DReps)
 */
export const getApiKey = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!user.drepRegistration) {
      return res.status(400).json({
        success: false,
        error: "No DRep linked",
        message: "You don't have a DRep registration linked to your account",
      });
    }

    if (user.drepRegistration.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Not approved",
        message: "Your DRep registration is not yet approved",
        data: {
          status: user.drepRegistration.status,
        },
      });
    }

    // Fetch the API key
    const registration = await prisma.drepRegistration.findUnique({
      where: { id: user.drepRegistration.id },
      select: { apiKey: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        drepId: user.drepRegistration.drepId,
        apiKey: registration?.apiKey,
      },
    });
  } catch (error) {
    console.error("[Auth] Get API key error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get API key",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Reset DRep API key (self-service for linked and approved DReps)
 * Generates a new API key and invalidates the old one
 */
export const resetApiKey = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    if (!user.drepRegistration) {
      return res.status(400).json({
        success: false,
        error: "No DRep linked",
        message: "You don't have a DRep registration linked to your account",
      });
    }

    if (user.drepRegistration.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        error: "Not approved",
        message: "Your DRep registration is not yet approved",
        data: {
          status: user.drepRegistration.status,
        },
      });
    }

    // Generate new API key
    const newApiKey = generateApiKey();

    // Update the API key in database
    await prisma.drepRegistration.update({
      where: { id: user.drepRegistration.id },
      data: { apiKey: newApiKey },
    });

    console.log(`[Auth] API key reset for DRep: ${user.drepRegistration.drepId} by user ${user.id}`);

    return res.status(200).json({
      success: true,
      message: "API key reset successfully",
      data: {
        drepId: user.drepRegistration.drepId,
        apiKey: newApiKey,
      },
    });
  } catch (error) {
    console.error("[Auth] Reset API key error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reset API key",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
