import { Request, Response } from "express";
import { prisma } from "../../services";
import { DeliveryStatus, AlertChannel } from "@prisma/client";

/**
 * Get pending deadline alerts for Discord bot
 * Returns alerts with PENDING status for Discord channels
 * Uses API Key auth
 */
export const getPendingAlerts = async (req: Request, res: Response) => {
  try {
    const { channel, drepId, limit = "100" } = req.query;

    // Build where clause
    const where: Record<string, unknown> = {
      deliveryStatus: DeliveryStatus.PENDING,
    };

    // Filter by channel if specified
    if (channel) {
      const channelUpper = (channel as string).toUpperCase();
      if (!["DISCORD_CHANNEL", "DISCORD_DM", "WEB_PUSH"].includes(channelUpper)) {
        return res.status(400).json({
          success: false,
          error: "Invalid channel",
          message: "channel must be DISCORD_CHANNEL, DISCORD_DM, or WEB_PUSH",
        });
      }
      where.alertChannel = channelUpper as AlertChannel;
    } else {
      // Default to Discord alerts only (for bot polling)
      where.alertChannel = {
        in: [AlertChannel.DISCORD_CHANNEL, AlertChannel.DISCORD_DM],
      };
    }

    // Filter by drepId if specified
    if (drepId) {
      where.drepId = drepId as string;
    }

    // Get pending alerts with related data
    const alerts = await prisma.deadlineAlert.findMany({
      where,
      take: Math.min(parseInt(limit as string), 500),
      orderBy: [
        { daysBeforeExpiry: "asc" }, // Most urgent first
        { createdAt: "asc" },
      ],
    });

    // Enrich with proposal, DRep, and notification preference data
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const [proposal, drepRegistration, guildPost, notificationPreference] = await Promise.all([
          prisma.proposal.findUnique({
            where: { proposalId: alert.proposalId },
            select: {
              proposalId: true,
              title: true,
              governanceActionType: true,
              expirationEpoch: true,
              status: true,
            },
          }),
          prisma.drepRegistration.findUnique({
            where: { drepId: alert.drepId },
            select: {
              drepId: true,
              drepName: true,
              discordGuildId: true,
            },
          }),
          prisma.guildProposalPost.findFirst({
            where: {
              proposalId: alert.proposalId,
              drepId: alert.drepId,
            },
            select: {
              threadId: true,
              guildId: true,
            },
          }),
          // Fetch Discord User ID from notification preferences for DM alerts
          prisma.notificationPreference.findUnique({
            where: { drepId: alert.drepId },
            select: {
              discordUserId: true,
            },
          }),
        ]);

        return {
          ...alert,
          proposal,
          drepRegistration,
          guildPost,
          notificationPreference,
        };
      })
    );

    return res.status(200).json({
      success: true,
      alerts: enrichedAlerts,
      count: enrichedAlerts.length,
    });
  } catch (error) {
    console.error("[Notification] Error getting pending alerts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get pending alerts",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
