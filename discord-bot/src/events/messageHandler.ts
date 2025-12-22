/**
 * Handle message events for comment collection
 */

import { Message, PartialMessage } from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

/**
 * Get proposal ID from thread using database lookup
 * This is the primary method - uses GuildProposalPost table to map threadId to proposalId
 */
async function getProposalIdFromThreadLookup(message: Message): Promise<string | null> {
  // Check if in a thread
  if (!message.channel.isThread()) return null;

  try {
    // Look up the proposalId from the GuildProposalPost table using threadId
    const result = await apiClient.getProposalByThreadId(
      message.channel.id,
      config.drep.id!
    );

    if (result.success && result.proposalId) {
      return result.proposalId;
    }

    return null;
  } catch (error) {
    console.error("[Message] Error looking up proposal by thread ID:", error);
    return null;
  }
}

/**
 * Check if message is in a proposal thread by checking embed footer
 * This is used as a quick check before making the API call
 */
async function isProposalThread(message: Message): Promise<boolean> {
  if (!message.channel.isThread()) return false;

  try {
    const starterMessage = await message.channel.fetchStarterMessage();
    if (!starterMessage) return false;

    if (!starterMessage.embeds || starterMessage.embeds.length === 0) return false;

    const embed = starterMessage.embeds[0];
    return embed.footer?.text === "Cardano Governance Feedback";
  } catch (error) {
    return false;
  }
}


/**
 * Handle new message event
 */
export async function handleMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore empty messages
  if (!message.content.trim()) return;

  try {
    // Quick check: is this a proposal thread? (check embed footer)
    if (!await isProposalThread(message)) return;

    // Look up proposalId using thread ID from database
    const proposalId = await getProposalIdFromThreadLookup(message);

    // Not related to a proposal (not in our GuildProposalPost table)
    if (!proposalId) return;

    // Get guild info
    const guild = message.guild;
    if (!guild) return;

    const channel = message.channel;

    // Submit comment to API (no sentiment detection - only button votes count)
    await apiClient.submitComment({
      proposalId,
      drepId: config.drep.id!,
      guildId: guild.id,
      guildName: guild.name,
      channelId: channel.id,
      channelName: "name" in channel ? (channel.name ?? "unknown") : "unknown",
      discordUserId: message.author.id,
      discordUsername: message.author.username,
      content: message.content,
      messageId: message.id,
    });

    console.log(
      `[Message] Comment collected from ${message.author.username} on proposal ${proposalId}`
    );
  } catch (error) {
    console.error("[Message] Error handling message:", error);
  }
}
