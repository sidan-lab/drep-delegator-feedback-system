/**
 * Proposal Sync Cron Job
 * Periodically syncs all proposals from Koios API to database
 * Also updates NCL (Net Change Limit) data for treasury withdrawals
 * Uses database-level locking via SyncStatus table to prevent concurrent runs
 */

import cron from "node-cron";
import { syncAllProposals } from "../services/ingestion/proposal.service";
import { updateNCL } from "../services/ingestion/ncl.service";
import { prisma } from "../services";

const JOB_NAME = "proposal-sync";
const DISPLAY_NAME = "Proposal Sync";
const LOCK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (matches Cloud Run max timeout)

/**
 * Starts the proposal sync cron job
 * Schedule is configurable via PROPOSAL_SYNC_SCHEDULE env variable (required)
 */
export const startProposalSyncJob = () => {
  const schedule = process.env.PROPOSAL_SYNC_SCHEDULE;
  const enabled = process.env.ENABLE_CRON_JOBS !== "false";

  if (!enabled) {
    console.log(
      "[Cron] Proposal sync job disabled via ENABLE_CRON_JOBS env variable"
    );
    return;
  }

  // Check if schedule is defined
  if (!schedule) {
    console.error(
      "[Cron] PROPOSAL_SYNC_SCHEDULE env variable is not set. Proposal sync job will not run."
    );
    return;
  }

  // Validate cron schedule
  if (!cron.validate(schedule)) {
    console.error(
      `[Cron] Invalid cron schedule: ${schedule}. Proposal sync job will not run.`
    );
    return;
  }

  startProposalSyncJobWithSchedule(schedule);
};

/**
 * Internal function to start the job with a specific schedule
 */
function startProposalSyncJobWithSchedule(schedule: string) {
  cron.schedule(schedule, async () => {
    const timestamp = new Date().toISOString();
    const now = new Date();

    try {
      // Try to acquire database lock
      const acquired = await prisma.$transaction(async (tx) => {
        // Clear expired locks (in case previous run crashed)
        await tx.syncStatus.updateMany({
          where: {
            jobName: JOB_NAME,
            isRunning: true,
            expiresAt: { lt: now },
          },
          data: {
            isRunning: false,
            lastResult: "expired",
            errorMessage: "Lock expired - previous run may have crashed",
          },
        });

        // Check if job is already running
        const status = await tx.syncStatus.findUnique({
          where: { jobName: JOB_NAME },
        });

        if (status?.isRunning) {
          return false;
        }

        // Acquire lock
        await tx.syncStatus.upsert({
          where: { jobName: JOB_NAME },
          create: {
            jobName: JOB_NAME,
            displayName: DISPLAY_NAME,
            isRunning: true,
            startedAt: now,
            expiresAt: new Date(now.getTime() + LOCK_EXPIRY_MS),
            lockedBy: process.env.HOSTNAME || "cron-service",
          },
          update: {
            isRunning: true,
            startedAt: now,
            expiresAt: new Date(now.getTime() + LOCK_EXPIRY_MS),
            lockedBy: process.env.HOSTNAME || "cron-service",
            errorMessage: null,
          },
        });

        return true;
      });

      if (!acquired) {
        console.log(
          `[${timestamp}] Proposal sync job is still running from a previous trigger. Skipping this run.`
        );
        return;
      }

      console.log(`\n[${timestamp}] Starting proposal sync job...`);

      const results = await syncAllProposals();

      console.log(
        `[${timestamp}] Proposal sync completed:`,
        `\n  - Total: ${results.total}`,
        `\n  - Success: ${results.success}`,
        `\n  - Failed: ${results.failed}`
      );

      // Log errors if any
      if (results.errors.length > 0) {
        console.error(
          `[${timestamp}] Errors encountered during sync:`,
          results.errors
        );
      }

      // Update NCL (Net Change Limit) after proposal sync
      try {
        const nclResult = await updateNCL();
        console.log(
          `[${timestamp}] NCL update completed:`,
          `\n  - Year: ${nclResult.year}`,
          `\n  - Epoch: ${nclResult.epoch}`,
          `\n  - Current: ${nclResult.currentValue.toLocaleString()} ADA`,
          `\n  - Proposals included: ${nclResult.proposalsIncluded}`
        );
      } catch (nclError: any) {
        console.error(`[${timestamp}] NCL update failed:`, nclError.message);
      }

      // Mark sync as completed
      await prisma.syncStatus.update({
        where: { jobName: JOB_NAME },
        data: {
          isRunning: false,
          completedAt: new Date(),
          lastResult: "success",
          itemsProcessed: results.success,
          expiresAt: null,
          errorMessage: null,
        },
      });
    } catch (error: any) {
      console.error(`[${timestamp}] Proposal sync job failed:`, error.message);

      // Mark sync as failed
      try {
        await prisma.syncStatus.update({
          where: { jobName: JOB_NAME },
          data: {
            isRunning: false,
            completedAt: new Date(),
            lastResult: "failed",
            expiresAt: null,
            errorMessage: error.message,
          },
        });
      } catch (updateError) {
        console.error(
          `[${timestamp}] Failed to update sync status:`,
          updateError
        );
      }
    }
  });

  console.log(`[Cron] Proposal sync job scheduled with cron: ${schedule}`);
  console.log(`[Cron] Next execution times:`);

  // Show next 3 execution times
  const cronJob = cron.schedule(schedule, () => {});
  console.log(`  - Job will run at the specified schedule`);
  cronJob.stop();
}
