/**
 * Deadline Alerts Cron Job
 * Periodically checks for proposals approaching voting deadlines
 * Creates DeadlineAlert records for DReps based on their notification preferences
 * Sends web push notifications immediately; Discord alerts are polled by bot
 */

import cron from "node-cron";
import { prisma } from "../services";
import {
  sendPushNotification,
  createDeadlineAlertPayload,
  initWebPush,
  isWebPushEnabled,
} from "../services/webPush.service";
import { getCurrentEpoch } from "../services/ingestion/proposal.service";
import { AlertChannel, AlertRecipientType, DeliveryStatus } from "@prisma/client";

const JOB_NAME = "deadline-alerts";
const DISPLAY_NAME = "Deadline Alerts";
const LOCK_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Cardano epoch length in days
const EPOCH_LENGTH_DAYS = 5;

/**
 * Calculate days until a proposal expires
 */
function getDaysUntilExpiry(expirationEpoch: number, currentEpoch: number): number {
  const epochsRemaining = expirationEpoch - currentEpoch;
  return Math.ceil(epochsRemaining * EPOCH_LENGTH_DAYS);
}

/**
 * Find the matching alert threshold for given days remaining
 * Returns the threshold if we should send an alert, null otherwise
 */
function findMatchingThreshold(daysRemaining: number, alertDays: number[]): number | null {
  // Sort thresholds descending
  const sortedDays = [...alertDays].sort((a, b) => b - a);

  for (const threshold of sortedDays) {
    // Send alert when days remaining falls within the threshold window
    // e.g., for 7-day threshold: send when 5 < daysRemaining <= 7 (accounting for epoch boundaries)
    // For simplicity, we alert when daysRemaining <= threshold
    if (daysRemaining > 0 && daysRemaining <= threshold) {
      return threshold;
    }
  }

  return null;
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

  // Initialize web push (will log warning if VAPID not configured)
  initWebPush();

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

      // Get current epoch from Koios
      const currentEpoch = await getCurrentEpoch();
      console.log(`[${timestamp}] Current epoch: ${currentEpoch}`);

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
      let webPushSent = 0;
      let webPushFailed = 0;
      let guildPostsUpdated = 0;

      // Process each proposal
      for (const proposal of activeProposals) {
        if (!proposal.expirationEpoch) continue;

        const daysRemaining = getDaysUntilExpiry(proposal.expirationEpoch, currentEpoch);

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
          if (prefs.webPushEnabled && prefs.pushSubscription) channels.push(AlertChannel.WEB_PUSH);

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
            const alert = await prisma.deadlineAlert.upsert({
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

            // Send web push immediately
            if (channel === AlertChannel.WEB_PUSH && isWebPushEnabled() && prefs.pushSubscription) {
              const payload = createDeadlineAlertPayload({
                proposalTitle: proposal.title,
                proposalId: proposal.proposalId,
                daysRemaining,
                drepHasVoted,
                proposalType: proposal.governanceActionType || undefined,
              });

              const result = await sendPushNotification(prefs.pushSubscription, payload);

              if (result.success) {
                webPushSent++;
                await prisma.deadlineAlert.update({
                  where: { id: alert.id },
                  data: {
                    deliveryStatus: DeliveryStatus.SENT,
                    sentAt: new Date(),
                  },
                });
              } else {
                webPushFailed++;
                await prisma.deadlineAlert.update({
                  where: { id: alert.id },
                  data: {
                    deliveryStatus: DeliveryStatus.FAILED,
                    errorMessage: result.error,
                  },
                });

                // If subscription expired, clear it from preferences
                if (result.expired) {
                  await prisma.notificationPreference.update({
                    where: { drepId: drep.drepId },
                    data: {
                      webPushEnabled: false,
                      pushSubscription: null,
                    },
                  });
                  console.log(`[${timestamp}] Cleared expired push subscription for DRep ${drep.drepId}`);
                }
              }
            }
          }
        }
      }

      console.log(
        `[${timestamp}] Deadline alerts completed:`,
        `\n  - Alerts created: ${alertsCreated}`,
        `\n  - Web push sent: ${webPushSent}`,
        `\n  - Web push failed: ${webPushFailed}`,
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
