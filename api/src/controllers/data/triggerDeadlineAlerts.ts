import { Request, Response } from "express";
import { prisma } from "../../services";
import { getCurrentEpochInfo } from "../../services/ingestion/proposal.service";
import { AlertChannel, AlertRecipientType, DeliveryStatus } from "@prisma/client";
import { getDaysUntilExpiry, findMatchingThreshold } from "../../jobs/deadline-alerts.job";

const JOB_NAME = "deadline-alerts";
const DISPLAY_NAME = "Deadline Alerts";
const LOCK_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /data/trigger-deadline-alerts
 *
 * Manually trigger deadline alerts check (for testing/admin use and Cloud Scheduler cron)
 * Uses database-level locking to prevent concurrent runs
 */
export const postTriggerDeadlineAlerts = async (_req: Request, res: Response) => {
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
          lockedBy: process.env.HOSTNAME || "api-instance",
        },
        update: {
          isRunning: true,
          startedAt: now,
          expiresAt: new Date(now.getTime() + LOCK_EXPIRY_MS),
          lockedBy: process.env.HOSTNAME || "api-instance",
          errorMessage: null,
        },
      });

      return true;
    });

    if (!acquired) {
      console.log(`[${timestamp}] Deadline alerts job is already running. Skipping.`);
      return res.status(409).json({
        success: false,
        message: "Deadline alerts job is already running. Please try again later.",
      });
    }

    console.log(`[${timestamp}] Deadline alerts job triggered via API endpoint`);

    // Get current epoch and block time from Koios
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

        // Check if DRep has voted on this proposal
        const existingVote = await prisma.onchainVote.findFirst({
          where: {
            proposalId: proposal.proposalId,
            drepId: drep.drepId,
            voterType: "DREP",
          },
          orderBy: {
            votedAt: "desc",
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

        // If DRep has voted, update GuildProposalPost records
        if (drepHasVoted && existingVote) {
          const updateResult = await prisma.guildProposalPost.updateMany({
            where: {
              proposalId: proposal.proposalId,
              drepId: drep.drepId,
              OR: [
                { drepVote: null },
                { drepVote: { not: existingVote.vote } },
              ],
            },
            data: {
              drepVote: existingVote.vote,
              drepVoteTxHash: existingVote.txHash,
              drepVotedAt: existingVote.votedAt,
              drepRationaleUrl: existingVote.anchorUrl,
              discordNotifiedAt: null,
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
          // Check if this alert already exists
          const existingAlert = await prisma.deadlineAlert.findFirst({
            where: {
              proposalId: proposal.proposalId,
              drepId: drep.drepId,
              recipientType: AlertRecipientType.DREP,
              recipientId: drep.drepId,
              alertChannel: channel,
              OR: [
                { daysBeforeExpiry: threshold, drepVote: drepVote },
                {
                  deliveryStatus: DeliveryStatus.SENT,
                  sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                  drepVote: drepVote,
                },
              ],
            },
          });

          if (existingAlert) continue;

          // Create or update the alert
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
        }
      }
    }

    console.log(
      `[${timestamp}] Deadline alerts completed:`,
      `\n  - Alerts created: ${alertsCreated}`,
      `\n  - Guild posts updated: ${guildPostsUpdated}`
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

    res.json({
      success: true,
      message: "Deadline alerts check completed",
      results: {
        alertsCreated,
        guildPostsUpdated,
        activeProposals: activeProposals.length,
        drepsWithPrefs: drepsWithPrefs.length,
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

    res.status(500).json({
      success: false,
      error: "Failed to run deadline alerts check",
      message: errorMessage,
    });
  }
};
