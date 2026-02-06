import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Delete notification preferences for the authenticated DRep
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const deletePreferences = async (req: Request, res: Response) => {
  try {
    const drepRegistration = req.user?.drepRegistration;

    if (!drepRegistration?.drepId) {
      return res.status(403).json({
        success: false,
        error: "DRep registration required",
        message: "You must be a registered DRep to manage notification preferences",
      });
    }

    // Check if preferences exist
    const existing = await prisma.notificationPreference.findUnique({
      where: { drepId: drepRegistration.drepId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "No notification preferences found for this DRep",
      });
    }

    // Delete preferences
    await prisma.notificationPreference.delete({
      where: { drepId: drepRegistration.drepId },
    });

    return res.status(200).json({
      success: true,
      message: "Notification preferences deleted",
      drepId: drepRegistration.drepId,
    });
  } catch (error) {
    console.error("[Notification] Error deleting preferences:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete notification preferences",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
