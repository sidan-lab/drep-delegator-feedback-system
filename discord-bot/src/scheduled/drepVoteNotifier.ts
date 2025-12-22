/**
 * Scheduled task for notifying Discord about DRep votes
 * Polls the API for pending notifications and updates forum threads
 */

import {
  Client,
  EmbedBuilder,
  ThreadChannel,
} from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

// Polling interval in milliseconds (30 seconds)
const POLL_INTERVAL = 30 * 1000;

let pollingInterval: NodeJS.Timeout | null = null;
let lastLogTime: number = 0;

/**
 * Update a Discord thread with the DRep vote information
 */
async function updateThreadWithDrepVote(
  client: Client,
  notification: {
    id: string;
    guildId: string;
    threadId: string;
    drepVote: "YES" | "NO" | "ABSTAIN";
    drepRationaleUrl: string | null;
    drepVoteTxHash: string | null;
    drepVotedAt: string | null;
  }
): Promise<boolean> {
  try {
    // Get the thread channel
    const thread = await client.channels.fetch(notification.threadId);
    if (!thread || !(thread instanceof ThreadChannel)) {
      console.warn(
        `[DRepVote] Thread ${notification.threadId} not found or is not a thread`
      );
      return false;
    }

    // Fetch the first (original) message in the thread
    const messages = await thread.messages.fetch({ limit: 1, after: "0" });
    const starterMessage = messages.first();

    if (!starterMessage) {
      console.warn(
        `[DRepVote] No starter message found in thread ${notification.threadId}`
      );
      return false;
    }

    // Get the existing embed
    const existingEmbed = starterMessage.embeds[0];
    if (!existingEmbed) {
      console.warn(
        `[DRepVote] No embed found in starter message of thread ${notification.threadId}`
      );
      return false;
    }

    // Create updated embed with DRep vote section
    const updatedEmbed = EmbedBuilder.from(existingEmbed);

    // Remove any existing DRep Vote field (for vote changes)
    const existingFields = updatedEmbed.data.fields || [];
    const filteredFields = existingFields.filter(
      (field) => field.name !== "🗳️ DRep Vote"
    );
    updatedEmbed.setFields(filteredFields);

    // Add the DRep vote field
    const voteEmoji =
      notification.drepVote === "YES"
        ? "✅"
        : notification.drepVote === "NO"
          ? "❌"
          : "❓";

    let voteText = `${voteEmoji} **${notification.drepVote}**`;

    if (notification.drepRationaleUrl) {
      voteText += `\n📄 [View Rationale](${notification.drepRationaleUrl})`;
    }

    if (notification.drepVotedAt) {
      const votedDate = new Date(notification.drepVotedAt);
      voteText += `\n🕐 ${votedDate.toLocaleDateString()}`;
    }

    if (notification.drepVoteTxHash) {
      voteText += `\n🔗 [View on AdaStat](https://adastat.net/transactions/${notification.drepVoteTxHash})`;
    }

    updatedEmbed.addFields({
      name: "🗳️ DRep Vote",
      value: voteText,
      inline: false,
    });

    // Update the message
    await starterMessage.edit({
      embeds: [updatedEmbed],
    });

    console.log(
      `[DRepVote] Updated thread ${notification.threadId} with DRep vote: ${notification.drepVote}`
    );
    return true;
  } catch (error) {
    console.error(
      `[DRepVote] Error updating thread ${notification.threadId}:`,
      error
    );
    return false;
  }
}

/**
 * Process pending DRep vote notifications
 */
async function processPendingNotifications(client: Client): Promise<void> {
  try {
    // Fetch pending notifications for this DRep
    const drepId = config.drep.id;
    if (!drepId) {
      return; // No DRep configured
    }

    const result = await apiClient.getPendingDrepVoteNotifications(drepId);

    if (!result.success) {
      console.log(`[DRepVote] Poll check: API call failed`);
      return;
    }

    if (result.notifications.length === 0) {
      // Only log every 5 minutes to avoid spam
      const now = Date.now();
      if (now - lastLogTime > 300000) {
        console.log(`[DRepVote] Poll check: No pending notifications`);
        lastLogTime = now;
      }
      return;
    }

    console.log(
      `[DRepVote] Processing ${result.notifications.length} pending notification(s)`
    );

    for (const notification of result.notifications) {
      // Update the Discord thread
      const success = await updateThreadWithDrepVote(client, notification);

      if (success) {
        // Mark as notified in the API
        await apiClient.markDrepVoteNotified(notification.id);
      }

      // Small delay between updates to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[DRepVote] Error processing notifications:", error);
  }
}

/**
 * Initialize the DRep vote notifier scheduled task
 */
export function initDrepVoteNotifier(client: Client): void {
  // Check if DRep ID is configured
  if (!config.drep.id) {
    console.log("[DRepVote] DREP_ID not configured, DRep vote notifier disabled");
    return;
  }

  console.log(
    `[DRepVote] Initializing DRep vote notifier (polling every ${POLL_INTERVAL / 1000}s)`
  );

  // Run immediately on startup
  processPendingNotifications(client);

  // Set up polling interval
  pollingInterval = setInterval(() => {
    processPendingNotifications(client);
  }, POLL_INTERVAL);

  console.log("[DRepVote] DRep vote notifier initialized");
}

/**
 * Stop the DRep vote notifier
 */
export function stopDrepVoteNotifier(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[DRepVote] DRep vote notifier stopped");
  }
}
