import { Request, Response } from "express";
import { syncAllVoterVotingPower } from "../../services/ingestion/voter.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * POST /data/trigger-voter-sync
 *
 * Manually trigger voter power sync (for testing/admin use and Cloud Scheduler cron)
 */
export const postTriggerVoterSync = async (_req: Request, res: Response) => {
  try {
    console.log("[Manual Voter Sync] Triggered via API endpoint");

    const results = await syncAllVoterVotingPower(prisma);

    console.log("[Manual Voter Sync] ✓ Completed successfully");

    res.json({
      success: true,
      message: "Voter power sync completed",
      results,
    });
  } catch (error) {
    console.error("[Manual Voter Sync] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      error: "Failed to sync voter power",
      message: errorMessage,
    });
  }
};
