/**
 * Deadline Alerts Cron Job
 * Periodically checks for proposals approaching voting deadlines
 * Creates DeadlineAlert records for DReps based on their notification preferences
 * Discord alerts are polled by bot; in-app toasts are polled by frontend
 */

import cron from "node-cron";
import { prisma } from "../services";
import { getCurrentEpochInfo } from "../services/ingestion/proposal.service";
import { AlertChannel, AlertRecipientType, DeliveryStatus } from "@prisma/client";
import { getSecondsUntilEpoch } from "../utils/epoch.utils";

const JOB_NAME = "deadline-alerts";
const DISPLAY_NAME = "Deadline Alerts";
const LOCK_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Calculate days until a proposal expires.
 * Uses actual timestamps for accuracy rather than epoch arithmetic.
 *
 * Voting ends at the END of epoch (expirationEpoch - 2).
 * For expirationEpoch N, voting ends at epochToTimestamp(N - 1) - 1 second.
 *
 * Example:
 * - Current time: 2026-02-03 22:00:00 UTC (early in epoch 610)
 * - Expiration epoch: 613
 * - Voting ends: 2026-02-13 21:44:50 UTC (END of epoch 611)
 * - Days remaining: ceil((2026-02-13 21:44:50 - 2026-02-03 22:00:00) / 86400) = 10 days
 *
 * @param expirationEpoch - First epoch where voting is NO LONGER valid
 * @param currentBlockTime - Current Unix timestamp in seconds (from Koios /tip)
 * @returns Days remaining until expiration (rounded up)
 */
export function getDaysUntilExpiry(expirationEpoch: number, currentBlockTime: number): number {
  // Voting ends at END of epoch (expirationEpoch - 2)
  // = epochToTimestamp(expirationEpoch - 1) - 1 second
  const secondsRemaining = getSecondsUntilEpoch(expirationEpoch - 1, currentBlockTime) - 1;
  const daysRemaining = secondsRemaining / 86400; // 86400 = seconds per day
  return Math.max(0, Math.ceil(daysRemaining));
}

/**
 * Find if the current daysRemaining matches any configured alert threshold.
 * Uses exact matching to ensure multiple alerts fire at different thresholds.
 *
 * Example: With alertDays=[7, 3, 1]:
 * - daysRemaining=7 → returns 7 (fires 7-day alert)
 * - daysRemaining=5 → returns null (no alert)
 * - daysRemaining=3 → returns 3 (fires 3-day alert)
 * - daysRemaining=1 → returns 1 (fires 1-day alert)
 *
 * Note: With 5-day Cardano epochs, daysRemaining can skip values.
 * Choose thresholds that align with epoch boundaries (e.g., [5, 1] or [10, 5, 1])
 *
 * @param daysRemaining - Days until proposal voting deadline
 * @param alertDays - Configured alert thresholds (e.g., [7, 3, 1])
 * @returns The matching threshold, or null if no exact match
 */
export function findMatchingThreshold(daysRemaining: number, alertDays: number[]): number | null {
  // Only alert on exact threshold match
  // This ensures multiple alerts fire at different thresholds (e.g., 7, 3, 1 days)
  return alertDays.includes(daysRemaining) ? daysRemaining : null;
}

/**
 * Starts the deadline alerts cron job
 * Schedule is configurable via DEADLINE_ALERT_SCHEDULE env variable
 */
export const startDeadlineAlertsJob = () => {
  const schedule = process.env.DEADLINE_ALERT_SCHEDULE || "0 9 * * *"; // Default: daily at 9 AM
  const enabled = process.env.ENABLE_CRON_JOBS !== "false";

  if (!enabled) {
    console.log("[Cron] Deadline alerts job disabled via ENABLE_CRON_JOBS env variable");
    return;
  }

  // Validate cron schedule
  if (!cron.validate(schedule)) {
    console.error(`[Cron] Invalid cron schedule: ${schedule}. Deadline alerts job will not run.`);
    return;
  }

  startDeadlineAlertsJobWithSchedule(schedule);
};

/**
 * Internal function to start the job with a specific schedule
 */
function startDeadlineAlertsJobWithSchedule(schedule: string) {
  cron.schedule(schedule, async () => {
    const timestamp = new Date().toISOString();
    const now = new Date();

    try {
      // Try to acquire database lock
      const acquired = await prisma.$transaction(async (tx) => {
        // Clear expired locks
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
        console.log(`[${timestamp}] Deadline alerts job is still running. Skipping this run.`);
        return;
      }

      console.log(`\n[${timestamp}] Starting deadline alerts job...`);

      // Get current epoch and block time from Koios in a single API call
      const { epochNo: currentEpoch, blockTime: currentBlockTime } = await getCurrentEpochInfo();
      console.log(
        `[${timestamp}] Current epoch: ${currentEpoch}, block time: ${new Date(currentBlockTime * 1000).toISOString()}`
      );

      // Get all active proposals with expiration dates
      const activeProposals = await prisma.proposal.findMany({
        where: {
          status: "ACTIVE",
          expirationEpoch: { not: null },
        },
        select: {
          proposalId: true,
          title: true,
          governanceActionType: true,
          expirationEpoch: true,
        },
      });

      console.log(`[${timestamp}] Found ${activeProposals.length} active proposals`);

      // Get all approved DReps with notification preferences
      const drepsWithPrefs = await prisma.drepRegistration.findMany({
        where: {
          status: "APPROVED",
          notificationPreference: { isNot: null },
        },
        include: {
          notificationPreference: true,
          guilds: {
            where: { isActive: true },
            select: { guildId: true },
          },
        },
      });

      console.log(`[${timestamp}] Found ${drepsWithPrefs.length} DReps with notification preferences`);

      let alertsCreated = 0;
      let guildPostsUpdated = 0;

      // Process each proposal
      for (const proposal of activeProposals) {
        if (!proposal.expirationEpoch) continue;

        const daysRemaining = getDaysUntilExpiry(proposal.expirationEpoch, currentBlockTime);

        // Skip if proposal has already expired or too far away (> 30 days)
        if (daysRemaining <= 0 || daysRemaining > 30) continue;

        // Process each DRep
        for (const drep of drepsWithPrefs) {
          const prefs = drep.notificationPreference;
          if (!prefs) continue;

          // Find matching threshold for this DRep's preferences
          const threshold = findMatchingThreshold(daysRemaining, prefs.alertDays);
          if (!threshold) continue;

          // Check if DRep has voted on this proposal (get latest vote if multiple exist)
          const existingVote = await prisma.onchainVote.findFirst({
            where: {
              proposalId: proposal.proposalId,
              drepId: drep.drepId,
              voterType: "DREP",
            },
            orderBy: {
              votedAt: "desc", // Get the most recent vote (in case DRep changed their vote)
            },
            select: {
              vote: true,
              txHash: true,
              votedAt: true,
              anchorUrl: true,
            },
          });
          const drepHasVoted = !!existingVote;
          const drepVote = existingVote?.vote || null;

          // If DRep has voted, update GuildProposalPost records to trigger Discord notification
          if (drepHasVoted && existingVote) {
            const updateResult = await prisma.guildProposalPost.updateMany({
              where: {
                proposalId: proposal.proposalId,
                drepId: drep.drepId,
                OR: [
                  { drepVote: null }, // Not yet set
                  { drepVote: { not: existingVote.vote } }, // Vote changed
                ],
              },
              data: {
                drepVote: existingVote.vote,
                drepVoteTxHash: existingVote.txHash,
                drepVotedAt: existingVote.votedAt,
                drepRationaleUrl: existingVote.anchorUrl,
                discordNotifiedAt: null, // Reset to trigger DRep Vote Notifier again
              },
            });
            guildPostsUpdated += updateResult.count;
          }

          // Create alerts for each enabled channel
          const channels: AlertChannel[] = [];
          if (prefs.discordChannelEnabled) channels.push(AlertChannel.DISCORD_CHANNEL);
          if (prefs.discordDmEnabled && prefs.discordUserId) channels.push(AlertChannel.DISCORD_DM);
          if (prefs.inAppToastEnabled) channels.push(AlertChannel.IN_APP_TOAST);

          for (const channel of channels) {
            // Check if this alert already exists (prevent duplicates)
            // Allow new alert if vote has changed since last sent alert
            const existingAlert = await prisma.deadlineAlert.findFirst({
              where: {
                proposalId: proposal.proposalId,
                drepId: drep.drepId,
                recipientType: AlertRecipientType.DREP,
                recipientId: drep.drepId,
                alertChannel: channel,
                OR: [
                  // Exact threshold match with same vote (already sent for this threshold)
                  { daysBeforeExpiry: threshold, drepVote: drepVote },
                  // Any alert sent in the last 24 hours with same vote (prevent spam)
                  {
                    deliveryStatus: DeliveryStatus.SENT,
                    sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                    drepVote: drepVote,
                  },
                ],
              },
            });

            if (existingAlert) continue;

            // Create or update the alert (update if vote changed)
            await prisma.deadlineAlert.upsert({
              where: {
                proposalId_drepId_recipientType_recipientId_alertChannel_daysBeforeExpiry: {
                  proposalId: proposal.proposalId,
                  drepId: drep.drepId,
                  recipientType: AlertRecipientType.DREP,
                  recipientId: drep.drepId,
                  alertChannel: channel,
                  daysBeforeExpiry: threshold,
                },
              },
              create: {
                proposalId: proposal.proposalId,
                drepId: drep.drepId,
                recipientType: AlertRecipientType.DREP,
                recipientId: drep.drepId,
                alertChannel: channel,
                daysBeforeExpiry: threshold,
                drepHasVoted,
                drepVote,
                deliveryStatus: DeliveryStatus.PENDING,
              },
              update: {
                drepHasVoted,
                drepVote,
                deliveryStatus: DeliveryStatus.PENDING,
                sentAt: null,
                errorMessage: null,
              },
            });

            alertsCreated++;

            // For IN_APP_TOAST, alerts stay PENDING until frontend polls and marks as read
            // For Discord channels, alerts stay PENDING until bot polls and sends messages
          }
        }
      }

      console.log(
        `[${timestamp}] Deadline alerts completed:`,
        `\n  - Alerts created: ${alertsCreated}`,
        `\n  - Guild posts updated with DRep vote: ${guildPostsUpdated}`
      );

      // Mark job as completed
      await prisma.syncStatus.update({
        where: { jobName: JOB_NAME },
        data: {
          isRunning: false,
          completedAt: new Date(),
          lastResult: "success",
          itemsProcessed: alertsCreated,
          expiresAt: null,
          errorMessage: null,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${timestamp}] Deadline alerts job failed:`, errorMessage);

      // Mark job as failed
      try {
        await prisma.syncStatus.update({
          where: { jobName: JOB_NAME },
          data: {
            isRunning: false,
            completedAt: new Date(),
            lastResult: "failed",
            expiresAt: null,
            errorMessage,
          },
        });
      } catch (updateError) {
        console.error(`[${timestamp}] Failed to update sync status:`, updateError);
      }
    }
  });

  console.log(`[Cron] Deadline alerts job scheduled with cron: ${schedule}`);
}
