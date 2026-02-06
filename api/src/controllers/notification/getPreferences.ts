import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Get notification preferences for the authenticated DRep
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const getPreferences = async (req: Request, res: Response) => {
  try {
    const drepRegistration = req.user?.drepRegistration;

    if (!drepRegistration?.drepId) {
      return res.status(403).json({
        success: false,
        error: "DRep registration required",
        message: "You must be a registered DRep to manage notification preferences",
      });
    }

    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "DRep not approved",
        message: "Your DRep registration must be approved to manage notification preferences",
      });
    }

    const preference = await prisma.notificationPreference.findUnique({
      where: { drepId: drepRegistration.drepId },
    });

    return res.status(200).json({
      success: true,
      drepId: drepRegistration.drepId,
      preferences: preference || {
        discordChannelEnabled: true,
        discordDmEnabled: false,
        webPushEnabled: false,
        alertDays: [7, 3, 1],
        discordUserId: null,
        pushSubscription: null,
      },
    });
  } catch (error) {
    console.error("[Notification] Error getting preferences:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get notification preferences",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
