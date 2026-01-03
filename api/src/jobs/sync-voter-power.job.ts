/**
 * Voter Power Sync Cron Job
 * Periodically syncs DRep and SPO voting power from Koios API
 * Updates voting power based on the latest epoch data
 * Uses database-level locking via SyncStatus table to prevent concurrent runs
 */

import cron from "node-cron";
import { syncAllVoterVotingPower } from "../services/ingestion/voter.service";
import { prisma } from "../services";

const JOB_NAME = "voter-power-sync";
const DISPLAY_NAME = "Voter Power Sync";
const LOCK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (matches Cloud Run max timeout)

/**
 * Starts the voter power sync cron job
 * Schedule is configurable via VOTER_POWER_SYNC_SCHEDULE env variable (required)
 */
export const startVoterPowerSyncJob = () => {
  const schedule = process.env.VOTER_POWER_SYNC_SCHEDULE;
  const enabled = process.env.ENABLE_CRON_JOBS !== "false";

  if (!enabled) {
    console.log(
      "[Cron] Voter power sync job disabled via ENABLE_CRON_JOBS env variable"
    );
    return;
  }

  // Check if schedule is defined
  if (!schedule) {
    console.error(
      "[Cron] VOTER_POWER_SYNC_SCHEDULE env variable is not set. Voter power sync job will not run."
    );
    return;
  }

  // Validate cron schedule
  if (!cron.validate(schedule)) {
    console.error(
      `[Cron] Invalid cron schedule: ${schedule}. Voter power sync job will not run.`
    );
    return;
  }

  startVoterPowerSyncJobWithSchedule(schedule);
};

/**
 * Internal function to start the job with a specific schedule
 */
function startVoterPowerSyncJobWithSchedule(schedule: string) {
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
          `[${timestamp}] Voter power sync job is still running from a previous trigger. Skipping this run.`
        );
        return;
      }

      console.log(`\n[${timestamp}] Starting voter power sync job...`);

      const results = await syncAllVoterVotingPower(prisma);

      console.log(
        `[${timestamp}] Voter power sync completed for epoch ${results.epoch}:`,
        `\n  DReps:`,
        `\n    - Total: ${results.dreps.total}`,
        `\n    - Updated: ${results.dreps.updated}`,
        `\n    - Failed: ${results.dreps.failed}`,
        `\n  SPOs:`,
        `\n    - Total: ${results.spos.total}`,
        `\n    - Updated: ${results.spos.updated}`,
        `\n    - Failed: ${results.spos.failed}`
      );

      // Log errors if any
      if (results.dreps.errors.length > 0) {
        console.error(
          `[${timestamp}] DRep sync errors:`,
          results.dreps.errors.slice(0, 10) // Limit to first 10 errors
        );
      }
      if (results.spos.errors.length > 0) {
        console.error(
          `[${timestamp}] SPO sync errors:`,
          results.spos.errors.slice(0, 10) // Limit to first 10 errors
        );
      }

      // Mark sync as completed
      await prisma.syncStatus.update({
        where: { jobName: JOB_NAME },
        data: {
          isRunning: false,
          completedAt: new Date(),
          lastResult: "success",
          itemsProcessed: results.dreps.updated + results.spos.updated,
          expiresAt: null,
          errorMessage: null,
        },
      });
    } catch (error: any) {
      console.error(
        `[${timestamp}] Voter power sync job failed:`,
        error.message
      );

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

  console.log(`[Cron] Voter power sync job scheduled with cron: ${schedule}`);
  console.log(`[Cron] Next execution times:`);

  // Show next execution info
  const cronJob = cron.schedule(schedule, () => {});
  console.log(`  - Job will run at the specified schedule`);
  cronJob.stop();
}
