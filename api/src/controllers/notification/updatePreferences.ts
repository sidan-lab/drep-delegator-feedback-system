import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Create or update notification preferences for the authenticated DRep
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const updatePreferences = async (req: Request, res: Response) => {
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

    const {
      discordChannelEnabled,
      discordDmEnabled,
      webPushEnabled,
      alertDays,
      discordUserId,
    } = req.body;

    // Validate alertDays if provided
    if (alertDays !== undefined) {
      if (!Array.isArray(alertDays)) {
        return res.status(400).json({
          success: false,
          error: "Invalid alertDays",
          message: "alertDays must be an array of numbers",
        });
      }

      const validDays = alertDays.every(
        (d: unknown) => typeof d === "number" && d > 0 && d <= 30
      );
      if (!validDays) {
        return res.status(400).json({
          success: false,
          error: "Invalid alertDays values",
          message: "Each alert day must be a number between 1 and 30",
        });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (discordChannelEnabled !== undefined) {
      updateData.discordChannelEnabled = Boolean(discordChannelEnabled);
    }
    if (discordDmEnabled !== undefined) {
      updateData.discordDmEnabled = Boolean(discordDmEnabled);
    }
    if (webPushEnabled !== undefined) {
      updateData.webPushEnabled = Boolean(webPushEnabled);
    }
    if (alertDays !== undefined) {
      updateData.alertDays = alertDays;
    }
    if (discordUserId !== undefined) {
      updateData.discordUserId = discordUserId || null;
    }

    // Upsert the preference
    const preference = await prisma.notificationPreference.upsert({
      where: { drepId: drepRegistration.drepId },
      create: {
        drepId: drepRegistration.drepId,
        discordChannelEnabled: updateData.discordChannelEnabled as boolean ?? true,
        discordDmEnabled: updateData.discordDmEnabled as boolean ?? false,
        inAppToastEnabled: updateData.inAppToastEnabled as boolean ?? true,
        alertDays: updateData.alertDays as number[] ?? [7, 3, 1],
        discordUserId: updateData.discordUserId as string ?? null,
      },
      update: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      drepId: drepRegistration.drepId,
      preferences: preference,
    });
  } catch (error) {
    console.error("[Notification] Error updating preferences:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update notification preferences",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
