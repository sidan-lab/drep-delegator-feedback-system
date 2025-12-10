/**
 * Slash command for delegator verification
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { config } from "../config";

const VERIFICATION_FRONTEND_URL = process.env.VERIFICATION_FRONTEND_URL || "http://localhost:3002";

export const verifyCommand = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Get a link to verify your DRep delegation and connect your wallet"),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Generate verification URL with user's Discord ID
    const verificationUrl = `${VERIFICATION_FRONTEND_URL}/verify/${userId}`;

    // Create embed with instructions
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Verify Your Delegation")
      .setDescription(
        `Hi **${username}**!\n\n` +
        `To participate in governance feedback, you need to verify that you're delegating to this DRep.\n\n` +
        `**Steps:**\n` +
        `1. Click the button below to open the verification page\n` +
        `2. Connect your Cardano wallet\n` +
        `3. If not delegated, delegate to the DRep\n` +
        `4. Click "Verify & Connect to Discord"\n` +
        `5. Return here and confirm your verification\n\n` +
        `Your verification link is unique to your Discord account.`
      )
      .addFields(
        { name: "DRep", value: config.drep.id, inline: true },
        { name: "Your Discord ID", value: userId, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Cardano Governance Verification" });

    // Create verification button
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Verify My Delegation")
        .setStyle(ButtonStyle.Link)
        .setURL(verificationUrl),
      new ButtonBuilder()
        .setCustomId("CONFIRM-VERIFICATION")
        .setLabel("I've Verified")
        .setStyle(ButtonStyle.Success)
    );

    // Send ephemeral message (only visible to the user)
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    console.log(`[Command] Verification link sent to ${username} (${userId})`);
  },
};
