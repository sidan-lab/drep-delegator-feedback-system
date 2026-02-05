/**
 * Get My Alerts Controller
 * Returns pending IN_APP_TOAST deadline alerts for the authenticated DRep
 */

import { Request, Response } from "express";
import { prisma } from "../../services";
import { AlertChannel, DeliveryStatus } from "@prisma/client";

/**
 * GET /notification/alerts/my-pending
 * Get pending deadline alerts for the authenticated DRep
 * Used by frontend polling hook to show in-app toast notifications
 */
export const getMyAlerts = async (req: Request, res: Response) => {
  try {
    const drepRegistration = req.user?.drepRegistration;

    if (!drepRegistration?.drepId) {
      return res.status(403).json({
        success: false,
        error: "DRep registration required",
      });
    }

    // Get unread deadline alerts for this DRep
    const alerts = await prisma.deadlineAlert.findMany({
      where: {
        drepId: drepRegistration.drepId,
        alertChannel: AlertChannel.IN_APP_TOAST,
        deliveryStatus: DeliveryStatus.PENDING,
      },
      orderBy: {
        daysBeforeExpiry: "asc", // Most urgent first (1 day before 3 days)
      },
      take: 10, // Limit to recent 10 alerts
    });

    // Fetch proposal details for each alert
    const formattedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const proposal = await prisma.proposal.findUnique({
          where: { proposalId: alert.proposalId },
          select: {
            proposalId: true,
            title: true,
            governanceActionType: true,
          },
        });

        return {
          id: alert.id,
          proposalId: alert.proposalId,
          daysBeforeExpiry: alert.daysBeforeExpiry,
          drepHasVoted: alert.drepHasVoted,
          drepVote: alert.drepVote,
          proposal: proposal
            ? {
                proposalId: proposal.proposalId,
                title: proposal.title || "Untitled Proposal",
                governanceActionType: proposal.governanceActionType,
              }
            : {
                proposalId: alert.proposalId,
                title: "Untitled Proposal",
                governanceActionType: null,
              },
        };
      })
    );

    return res.status(200).json({
      success: true,
      alerts: formattedAlerts,
      count: formattedAlerts.length,
    });
  } catch (error) {
    console.error("[getMyAlerts] Error fetching alerts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch deadline alerts",
    });
  }
};
