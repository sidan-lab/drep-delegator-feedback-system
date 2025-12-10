/**
 * Handle message events for comment collection
 */

import { Message, PartialMessage } from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

/**
 * Check if a message is a reply to a proposal message
 */
async function getProposalIdFromReply(message: Message): Promise<string | null> {
  // Check if message is a reply
  if (!message.reference?.messageId) return null;

  try {
    // Fetch the parent message
    const parentMessage = await message.channel.messages.fetch(
      message.reference.messageId
    );

    // Check if parent is a proposal message
    if (!parentMessage.embeds || parentMessage.embeds.length === 0) return null;

    const embed = parentMessage.embeds[0];

    // Check if it's our proposal embed
    if (
      embed.footer?.text !== "Cardano Governance Feedback" &&
      !embed.description?.includes("Proposal ID:")
    ) {
      return null;
    }

    // Extract proposal ID
    const description = embed.description || "";
    const match = description.match(/Proposal ID:\s*`([^`]+)`/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("[Message] Error fetching parent message:", error);
    return null;
  }
}

/**
 * Check if message is in a proposal thread
 */
async function getProposalIdFromThread(message: Message): Promise<string | null> {
  // Check if in a thread
  if (!message.channel.isThread()) return null;

  try {
    // Get the thread's starter message
    const starterMessage = await message.channel.fetchStarterMessage();
    if (!starterMessage) return null;

    // Check if starter message is a proposal message
    if (!starterMessage.embeds || starterMessage.embeds.length === 0) return null;

    const embed = starterMessage.embeds[0];

    // Check if it's our proposal embed
    if (
      embed.footer?.text !== "Cardano Governance Feedback" &&
      !embed.description?.includes("Proposal ID:")
    ) {
      return null;
    }

    // Extract proposal ID
    const description = embed.description || "";
    const match = description.match(/Proposal ID:\s*`([^`]+)`/);
    return match ? match[1] : null;
  } catch (error) {
    // Thread might not have a starter message (e.g., deleted)
    return null;
  }
}

/**
 * Detect sentiment from message content (basic keyword analysis)
 */
function detectSentiment(
  content: string
): "yes" | "no" | "abstain" | undefined {
  const lowerContent = content.toLowerCase();

  // Check for explicit sentiment indicators
  const yesIndicators = [
    "i support",
    "i agree",
    "yes",
    "in favor",
    "approve",
    "+1",
    "thumbs up",
    "good proposal",
    "great idea",
  ];

  const noIndicators = [
    "i oppose",
    "i disagree",
    "no",
    "against",
    "reject",
    "-1",
    "thumbs down",
    "bad proposal",
    "terrible idea",
  ];

  const abstainIndicators = [
    "abstain",
    "neutral",
    "undecided",
    "not sure",
    "need more info",
    "on the fence",
  ];

  for (const indicator of yesIndicators) {
    if (lowerContent.includes(indicator)) return "yes";
  }

  for (const indicator of noIndicators) {
    if (lowerContent.includes(indicator)) return "no";
  }

  for (const indicator of abstainIndicators) {
    if (lowerContent.includes(indicator)) return "abstain";
  }

  return undefined;
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
    // Try to get proposal ID from reply or thread
    let proposalId = await getProposalIdFromReply(message);

    if (!proposalId) {
      proposalId = await getProposalIdFromThread(message);
    }

    // Not related to a proposal
    if (!proposalId) return;

    // Get guild info
    const guild = message.guild;
    if (!guild) return;

    const channel = message.channel;

    // Detect sentiment from message content
    const sentiment = detectSentiment(message.content);

    // Submit comment to API
    await apiClient.submitComment({
      proposalId,
      drepId: config.drep.id,
      guildId: guild.id,
      guildName: guild.name,
      channelId: channel.id,
      channelName: "name" in channel ? channel.name : "unknown",
      discordUserId: message.author.id,
      discordUsername: message.author.username,
      content: message.content,
      messageId: message.id,
      sentiment,
    });

    console.log(
      `[Message] Comment collected from ${message.author.username} on proposal ${proposalId}` +
        (sentiment ? ` (sentiment: ${sentiment})` : "")
    );
  } catch (error) {
    console.error("[Message] Error handling message:", error);
  }
}
