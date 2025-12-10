/**
 * Handle reaction events for sentiment collection
 */

import {
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  EmbedBuilder,
} from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";
import type { SentimentType } from "../types";

// Map emoji names to sentiment types
const EMOJI_TO_SENTIMENT: Record<string, SentimentType> = {
  "👍": "yes",
  "thumbsup": "yes",
  "👎": "no",
  "thumbsdown": "no",
  "🤔": "abstain",
  "thinking": "abstain",
};

/**
 * Check if a message is a proposal message (has our embed format)
 */
function isProposalMessage(message: any): boolean {
  if (!message.embeds || message.embeds.length === 0) return false;

  const embed = message.embeds[0];
  // Check if it's our proposal embed by looking for specific fields
  return (
    embed.footer?.text === "Cardano Governance Feedback" ||
    embed.description?.includes("Proposal ID:")
  );
}

/**
 * Extract proposal ID from message
 */
function extractProposalId(message: any): string | null {
  if (!message.embeds || message.embeds.length === 0) return null;

  const embed = message.embeds[0];
  const description = embed.description || "";

  // Look for "Proposal ID: `xxx`" pattern
  const match = description.match(/Proposal ID:\s*`([^`]+)`/);
  return match ? match[1] : null;
}

/**
 * Get sentiment type from emoji
 */
function getSentimentFromEmoji(emoji: string): SentimentType | null {
  // Check direct emoji match
  if (EMOJI_TO_SENTIMENT[emoji]) {
    return EMOJI_TO_SENTIMENT[emoji];
  }

  // Check configured reactions
  if (emoji === config.reactions.yes || emoji.includes(config.reactions.yes)) {
    return "yes";
  }
  if (emoji === config.reactions.no || emoji.includes(config.reactions.no)) {
    return "no";
  }
  if (emoji === config.reactions.abstain || emoji.includes(config.reactions.abstain)) {
    return "abstain";
  }

  return null;
}

/**
 * Handle reaction add event
 */
export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  // Ignore bot reactions
  if (user.bot) return;

  try {
    // Fetch partial data if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const message = reaction.message;

    // Fetch message if partial
    if (message.partial) {
      await message.fetch();
    }

    // Check if this is a proposal message
    if (!isProposalMessage(message)) return;

    // Extract proposal ID
    const proposalId = extractProposalId(message);
    if (!proposalId) {
      console.warn("[Reaction] Could not extract proposal ID from message");
      return;
    }

    // Get sentiment from emoji
    const emojiName = reaction.emoji.name || reaction.emoji.toString();
    const sentiment = getSentimentFromEmoji(emojiName);

    if (!sentiment) {
      // Not a sentiment reaction, ignore
      return;
    }

    // Get guild info
    const guild = message.guild;
    if (!guild) return;

    const channel = message.channel;

    // Submit to API
    await apiClient.submitReaction({
      proposalId,
      drepId: config.drep.id,
      guildId: guild.id,
      guildName: guild.name,
      channelId: channel.id,
      channelName: "name" in channel ? channel.name : "unknown",
      discordUserId: user.id,
      discordUsername: user.username || "unknown",
      sentiment,
      action: "add",
    });

    console.log(
      `[Reaction] ${user.username} added ${sentiment} reaction to proposal ${proposalId}`
    );
  } catch (error) {
    console.error("[Reaction] Error handling reaction add:", error);
  }
}

/**
 * Handle reaction remove event
 */
export async function handleReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  // Ignore bot reactions
  if (user.bot) return;

  try {
    // Fetch partial data if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const message = reaction.message;

    // Fetch message if partial
    if (message.partial) {
      await message.fetch();
    }

    // Check if this is a proposal message
    if (!isProposalMessage(message)) return;

    // Extract proposal ID
    const proposalId = extractProposalId(message);
    if (!proposalId) return;

    // Get sentiment from emoji
    const emojiName = reaction.emoji.name || reaction.emoji.toString();
    const sentiment = getSentimentFromEmoji(emojiName);

    if (!sentiment) return;

    // Get guild info
    const guild = message.guild;
    if (!guild) return;

    const channel = message.channel;

    // Submit to API
    await apiClient.submitReaction({
      proposalId,
      drepId: config.drep.id,
      guildId: guild.id,
      guildName: guild.name,
      channelId: channel.id,
      channelName: "name" in channel ? channel.name : "unknown",
      discordUserId: user.id,
      discordUsername: user.username || "unknown",
      sentiment,
      action: "remove",
    });

    console.log(
      `[Reaction] ${user.username} removed ${sentiment} reaction from proposal ${proposalId}`
    );
  } catch (error) {
    console.error("[Reaction] Error handling reaction remove:", error);
  }
}