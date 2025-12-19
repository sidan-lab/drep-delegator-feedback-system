/**
 * Delegate Channel Utilities
 * Handles posting and updating the verification message in the delegate channel
 */

import {
  Client,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { config } from "../config";

/**
 * Delegate channel message text
 */
export const DELEGATE_TEXT = {
  TITLE: "Verify Your Delegation",
  DESCRIPTION: `Welcome! To participate in governance feedback and discussions, you need to verify that you are delegating to this DRep.

**How to verify:**
1. Click the **"Start Verification"** button below
2. Connect your Cardano wallet on the verification page
3. Sign a message to prove wallet ownership
4. Return here and click **"I've Verified"** to claim your role

Once verified, you'll gain access to governance channels and can vote on proposals.`,
};

/**
 * Generate or update the delegate channel message with verification button
 * Posts a new message or edits the existing one
 */
export async function generateDelegateChannelMessage(client: Client): Promise<{
  success: boolean;
  message: string;
}> {
  const delegateChannelId = config.channels.delegateChannelId;

  if (!delegateChannelId) {
    return {
      success: false,
      message: "DELEGATE_CHANNEL_ID is not configured",
    };
  }

  try {
    const delegateChannel = client.channels.cache.get(delegateChannelId);

    if (!delegateChannel) {
      return {
        success: false,
        message: `Delegate channel ${delegateChannelId} not found`,
      };
    }

    if (!(delegateChannel instanceof TextChannel)) {
      return {
        success: false,
        message: "Delegate channel is not a text channel",
      };
    }

    // Create the verification embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(DELEGATE_TEXT.TITLE)
      .setDescription(DELEGATE_TEXT.DESCRIPTION)
      .addFields(
        { name: "DRep", value: config.drep.id || "Not configured", inline: true }
      )
      .setFooter({ text: "Cardano Governance Verification" })
      .setTimestamp();

    // Create the verification button row
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("START-VERIFICATION")
        .setLabel("Start Verification")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔗"),
      new ButtonBuilder()
        .setCustomId("CONFIRM-VERIFICATION")
        .setLabel("I've Verified")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅")
    );

    // Try to find the latest bot message in the channel
    const messages = await delegateChannel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(
      (msg) => msg.author.id === client.user?.id && msg.embeds.length > 0
    );

    if (botMessage) {
      // Edit existing message
      await botMessage.edit({
        embeds: [embed],
        components: [row],
      });
      console.log(`[Delegate] Updated existing verification message in #${delegateChannel.name}`);
      return {
        success: true,
        message: `Updated verification message in #${delegateChannel.name}`,
      };
    } else {
      // Send new message
      await delegateChannel.send({
        embeds: [embed],
        components: [row],
      });
      console.log(`[Delegate] Posted new verification message in #${delegateChannel.name}`);
      return {
        success: true,
        message: `Posted verification message in #${delegateChannel.name}`,
      };
    }
  } catch (error) {
    console.error("[Delegate] Error generating delegate channel message:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
