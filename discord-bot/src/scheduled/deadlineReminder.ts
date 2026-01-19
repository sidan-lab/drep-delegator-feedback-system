/**
 * Scheduled task for sending deadline reminder notifications
 * Polls the API for pending deadline alerts and sends Discord notifications
 */

import { Client, EmbedBuilder, ThreadChannel, User } from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

// Polling interval in milliseconds (60 seconds)
const POLL_INTERVAL = 60 * 1000;

let pollingInterval: NodeJS.Timeout | null = null;
let lastLogTime: number = 0;

/**
 * Get urgency color based on days remaining
 * Red for 1 day, orange for 3 days, yellow for 7+ days
 */
function getUrgencyColor(daysRemaining: number): number {
  if (daysRemaining <= 1) return 0xe74c3c; // Red
  if (daysRemaining <= 3) return 0xe67e22; // Orange
  return 0xf1c40f; // Yellow
}

/**
 * Get urgency label based on days remaining
 */
function getUrgencyLabel(daysRemaining: number): string {
  if (daysRemaining <= 1) return "URGENT";
  if (daysRemaining <= 3) return "Soon";
  return "Reminder";
}

/**
 * Format DRep vote for display with emoji
 */
function formatDrepVote(vote: string | null): string {
  if (!vote) return "**Not Yet Voted**";
  switch (vote.toUpperCase()) {
    case "YES":
      return "Yes";
    case "NO":
      return "No";
    case "ABSTAIN":
      return "Abstain";
    default:
      return vote;
  }
}

/**
 * Create an embed for deadline reminder
 */
function createDeadlineEmbed(alert: {
  daysBeforeExpiry: number;
  drepHasVoted: boolean;
  drepVote?: string | null;
  proposal: {
    proposalId: string;
    title: string;
    governanceActionType: string | null;
  } | null;
}): EmbedBuilder {
  const daysRemaining = alert.daysBeforeExpiry;
  const urgencyLabel = getUrgencyLabel(daysRemaining);
  const proposal = alert.proposal;

  const embed = new EmbedBuilder()
    .setColor(getUrgencyColor(daysRemaining))
    .setTitle(`${urgencyLabel}: Voting Deadline Reminder`)
    .setDescription(proposal?.title || "Governance Proposal")
    .addFields(
      {
        name: "Time Remaining",
        value: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        inline: true,
      },
      {
        name: "DRep Vote Status",
        value: formatDrepVote(alert.drepVote || null),
        inline: true,
      }
    )
    .setFooter({ text: "React with your sentiment on the proposal thread" })
    .setTimestamp();

  if (proposal?.governanceActionType) {
    embed.addFields({
      name: "Type",
      value: formatProposalType(proposal.governanceActionType),
      inline: true,
    });
  }

  return embed;
}

/**
 * Format proposal type for display
 */
function formatProposalType(type: string): string {
  const typeMap: Record<string, string> = {
    INFO_ACTION: "Info Action",
    TREASURY_WITHDRAWALS: "Treasury Withdrawal",
    NEW_CONSTITUTION: "New Constitution",
    HARD_FORK_INITIATION: "Hard Fork",
    PROTOCOL_PARAMETER_CHANGE: "Parameter Change",
    NO_CONFIDENCE: "No Confidence",
    UPDATE_COMMITTEE: "Update Committee",
  };
  return typeMap[type] || type;
}

/**
 * Send a reminder to a Discord channel (forum thread)
 */
async function sendChannelReminder(
  client: Client,
  alert: {
    id: string;
    daysBeforeExpiry: number;
    drepHasVoted: boolean;
    proposal: {
      proposalId: string;
      title: string;
      governanceActionType: string | null;
    } | null;
    guildPost: {
      threadId: string;
      guildId: string;
    } | null;
  }
): Promise<boolean> {
  if (!alert.guildPost?.threadId) {
    console.warn(`[DeadlineReminder] No thread ID for alert ${alert.id}`);
    return false;
  }

  try {
    const thread = await client.channels.fetch(alert.guildPost.threadId);
    if (!thread || !(thread instanceof ThreadChannel)) {
      console.warn(
        `[DeadlineReminder] Thread ${alert.guildPost.threadId} not found or is not a thread`
      );
      return false;
    }

    const embed = createDeadlineEmbed(alert);

    await thread.send({
      content: alert.drepHasVoted
        ? `Voting deadline reminder for this proposal.`
        : `**Reminder:** The DRep hasn't voted on this proposal yet!`,
      embeds: [embed],
    });

    console.log(
      `[DeadlineReminder] Sent channel reminder to thread ${alert.guildPost.threadId}`
    );
    return true;
  } catch (error) {
    console.error(
      `[DeadlineReminder] Error sending channel reminder to thread ${alert.guildPost?.threadId}:`,
      error
    );
    return false;
  }
}

/**
 * Send a reminder via Discord DM
 */
async function sendDmReminder(
  client: Client,
  alert: {
    id: string;
    daysBeforeExpiry: number;
    drepHasVoted: boolean;
    recipientId: string;
    proposal: {
      proposalId: string;
      title: string;
      governanceActionType: string | null;
    } | null;
    drepRegistration: {
      drepId: string;
      drepName: string | null;
      discordGuildId: string | null;
    } | null;
  },
  discordUserId: string
): Promise<boolean> {
  try {
    // Fetch the user
    const user: User = await client.users.fetch(discordUserId);
    if (!user) {
      console.warn(`[DeadlineReminder] User ${discordUserId} not found`);
      return false;
    }

    const embed = createDeadlineEmbed(alert);
    embed.setFooter({
      text: `You can manage notification preferences in the DRep dashboard`,
    });

    await user.send({
      content: alert.drepHasVoted
        ? `Voting deadline reminder:`
        : `**Action needed:** You haven't voted on this proposal yet!`,
      embeds: [embed],
    });

    console.log(`[DeadlineReminder] Sent DM reminder to user ${discordUserId}`);
    return true;
  } catch (error: unknown) {
    const discordError = error as { code?: number };
    // User may have DMs disabled (error code 50007)
    if (discordError.code === 50007) {
      console.warn(
        `[DeadlineReminder] Cannot send DM to user ${discordUserId} - DMs disabled`
      );
    } else {
      console.error(
        `[DeadlineReminder] Error sending DM to user ${discordUserId}:`,
        error
      );
    }
    return false;
  }
}

/**
 * Process pending deadline alerts
 */
async function processPendingAlerts(client: Client): Promise<void> {
  try {
    const drepId = config.drep.id;
    if (!drepId) {
      return; // No DRep configured
    }

    const result = await apiClient.getPendingDeadlineAlerts(drepId);

    if (!result.success) {
      console.log(`[DeadlineReminder] Poll check: API call failed`);
      return;
    }

    if (result.alerts.length === 0) {
      // Only log every 5 minutes to avoid spam
      const now = Date.now();
      if (now - lastLogTime > 300000) {
        console.log(`[DeadlineReminder] Poll check: No pending alerts`);
        lastLogTime = now;
      }
      return;
    }

    console.log(
      `[DeadlineReminder] Processing ${result.alerts.length} pending alert(s)`
    );

    for (const alert of result.alerts) {
      let success = false;
      let errorMessage: string | undefined;

      if (alert.alertChannel === "DISCORD_CHANNEL") {
        success = await sendChannelReminder(client, alert);
        if (!success) {
          errorMessage = "Failed to send channel reminder";
        }
      } else if (alert.alertChannel === "DISCORD_DM") {
        // For DRep alerts, get Discord user ID from notification preferences
        // For now, we'll use the DRep's configured Discord user ID
        // This would need to be fetched from the API or stored in the alert
        const discordUserId = alert.drepRegistration?.discordGuildId;

        if (discordUserId) {
          success = await sendDmReminder(client, alert, discordUserId);
          if (!success) {
            errorMessage = "Failed to send DM - user may have DMs disabled";
          }
        } else {
          errorMessage = "No Discord user ID configured for DM";
        }
      }

      // Mark alert as sent or failed
      await apiClient.markAlertSent(
        alert.id,
        success ? "SENT" : "FAILED",
        errorMessage
      );

      // Small delay between alerts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[DeadlineReminder] Error processing alerts:", error);
  }
}

/**
 * Initialize the deadline reminder scheduled task
 */
export function initDeadlineReminder(client: Client): void {
  // Check if DRep ID is configured
  if (!config.drep.id) {
    console.log(
      "[DeadlineReminder] DREP_ID not configured, deadline reminder disabled"
    );
    return;
  }

  console.log(
    `[DeadlineReminder] Initializing deadline reminder (polling every ${POLL_INTERVAL / 1000}s)`
  );

  // Run immediately on startup
  processPendingAlerts(client);

  // Set up polling interval
  pollingInterval = setInterval(() => {
    processPendingAlerts(client);
  }, POLL_INTERVAL);

  console.log("[DeadlineReminder] Deadline reminder initialized");
}

/**
 * Stop the deadline reminder
 */
export function stopDeadlineReminder(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[DeadlineReminder] Deadline reminder stopped");
  }
}
