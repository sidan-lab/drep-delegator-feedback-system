import { Request, Response } from "express";
import { prisma } from "../../services";
import { DeliveryStatus } from "@prisma/client";

/**
 * Mark a deadline alert as sent or failed
 * Called by Discord bot after attempting to send notification
 * Uses API Key auth
 */
export const markAlertSent = async (req: Request, res: Response) => {
  try {
    const { alertId, status, errorMessage } = req.body;

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: "Missing alertId",
        message: "alertId is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Missing status",
        message: "status is required (SENT or FAILED)",
      });
    }

    const statusUpper = status.toUpperCase();
    if (!["SENT", "FAILED"].includes(statusUpper)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
        message: "status must be SENT or FAILED",
      });
    }

    // Check if alert exists
    const existing = await prisma.deadlineAlert.findUnique({
      where: { id: alertId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Alert not found",
      });
    }

    // Update the alert
    const updated = await prisma.deadlineAlert.update({
      where: { id: alertId },
      data: {
        deliveryStatus: statusUpper as DeliveryStatus,
        sentAt: statusUpper === "SENT" ? new Date() : null,
        errorMessage: statusUpper === "FAILED" ? errorMessage || "Unknown error" : null,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Alert marked as ${statusUpper}`,
      alert: {
        id: updated.id,
        deliveryStatus: updated.deliveryStatus,
        sentAt: updated.sentAt,
      },
    });
  } catch (error) {
    console.error("[Notification] Error marking alert sent:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to mark alert sent",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Batch mark multiple alerts as sent or failed
 * Called by Discord bot for efficiency
 * Uses API Key auth
 */
export const batchMarkAlertsSent = async (req: Request, res: Response) => {
  try {
    const { alerts } = req.body;

    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({
        success: false,
        error: "Missing alerts",
        message: "alerts array is required",
      });
    }

    const results = await Promise.all(
      alerts.map(async (alert: { alertId: string; status: string; errorMessage?: string }) => {
        try {
          const statusUpper = alert.status.toUpperCase();
          if (!["SENT", "FAILED"].includes(statusUpper)) {
            return { alertId: alert.alertId, success: false, error: "Invalid status" };
          }

          await prisma.deadlineAlert.update({
            where: { id: alert.alertId },
            data: {
              deliveryStatus: statusUpper as DeliveryStatus,
              sentAt: statusUpper === "SENT" ? new Date() : null,
              errorMessage: statusUpper === "FAILED" ? alert.errorMessage || "Unknown error" : null,
            },
          });

          return { alertId: alert.alertId, success: true };
        } catch (err) {
          return { alertId: alert.alertId, success: false, error: (err as Error).message };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return res.status(200).json({
      success: true,
      message: `Processed ${alerts.length} alerts: ${successCount} succeeded, ${failureCount} failed`,
      results,
    });
  } catch (error) {
    console.error("[Notification] Error batch marking alerts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to batch mark alerts",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
