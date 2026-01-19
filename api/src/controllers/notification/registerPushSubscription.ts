import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Register a web push subscription for the authenticated DRep
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const registerPushSubscription = async (req: Request, res: Response) => {
  try {
    const drepRegistration = req.user?.drepRegistration;

    if (!drepRegistration?.drepId) {
      return res.status(403).json({
        success: false,
        error: "DRep registration required",
        message: "You must be a registered DRep to register push notifications",
      });
    }

    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "DRep not approved",
        message: "Your DRep registration must be approved to register push notifications",
      });
    }

    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({
        success: false,
        error: "Missing subscription",
        message: "Push subscription object is required",
      });
    }

    // Validate subscription structure
    if (!subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: "Invalid subscription",
        message: "Push subscription must have endpoint and keys",
      });
    }

    // Stringify the subscription for storage
    const subscriptionJson = JSON.stringify(subscription);

    // Upsert the preference with push subscription
    const preference = await prisma.notificationPreference.upsert({
      where: { drepId: drepRegistration.drepId },
      create: {
        drepId: drepRegistration.drepId,
        webPushEnabled: true,
        pushSubscription: subscriptionJson,
      },
      update: {
        webPushEnabled: true,
        pushSubscription: subscriptionJson,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Push subscription registered",
      drepId: drepRegistration.drepId,
      webPushEnabled: preference.webPushEnabled,
    });
  } catch (error) {
    console.error("[Notification] Error registering push subscription:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to register push subscription",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Unregister a web push subscription for the authenticated DRep
 * Uses JWT auth - DRep info comes from req.user.drepRegistration
 */
export const unregisterPushSubscription = async (req: Request, res: Response) => {
  try {
    const drepRegistration = req.user?.drepRegistration;

    if (!drepRegistration?.drepId) {
      return res.status(403).json({
        success: false,
        error: "DRep registration required",
        message: "You must be a registered DRep to manage push notifications",
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

    // Clear push subscription
    await prisma.notificationPreference.update({
      where: { drepId: drepRegistration.drepId },
      data: {
        webPushEnabled: false,
        pushSubscription: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Push subscription removed",
      drepId: drepRegistration.drepId,
    });
  } catch (error) {
    console.error("[Notification] Error unregistering push subscription:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to unregister push subscription",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
