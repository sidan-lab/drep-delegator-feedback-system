/**
 * Slash command for creating proposal discussion threads
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

export const proposalCommand = {
  data: new SlashCommandBuilder()
    .setName("proposal")
    .setDescription("Manage governance proposal discussions")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("post")
        .setDescription("Post a governance proposal for community feedback")
        .addStringOption((option) =>
          option
            .setName("proposal_id")
            .setDescription("The governance proposal ID (gov_action... or txHash:certIndex)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Custom title for the proposal (optional)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List active governance proposals")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "post":
        await handlePostProposal(interaction);
        break;
      case "list":
        await handleListProposals(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand",
          ephemeral: true,
        });
    }
  },
};

async function handlePostProposal(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const proposalId = interaction.options.getString("proposal_id", true);
  const customTitle = interaction.options.getString("title");

  try {
    // Create the proposal embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(customTitle || `Governance Proposal`)
      .setDescription(
        `**Proposal ID:** \`${proposalId}\`\n\n` +
          `React below to share your sentiment on this proposal!\n\n` +
          `- 👍 = **Yes** (Support)\n` +
          `- 👎 = **No** (Against)\n` +
          `- 🤔 = **Abstain** (Neutral)\n\n` +
          `Or reply to this message with your feedback!`
      )
      .addFields(
        { name: "DRep", value: config.drep.id, inline: true },
        { name: "Status", value: "Open for feedback", inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Cardano Governance Feedback" });

    // Create view button
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("View on Governance Portal")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://gov.tools/governance_actions/${proposalId}`)
    );

    // Send the message
    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Add initial reactions
    if (message) {
      await message.react("👍");
      await message.react("👎");
      await message.react("🤔");
    }

    console.log(
      `[Command] Proposal posted: ${proposalId} in ${interaction.guild?.name}`
    );
  } catch (error) {
    console.error("[Command] Error posting proposal:", error);
    await interaction.editReply({
      content: "Failed to post proposal. Please try again.",
    });
  }
}

async function handleListProposals(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const proposals = await apiClient.getActiveProposals();

    if (proposals.length === 0) {
      await interaction.editReply({
        content: "No active governance proposals found.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Active Governance Proposals")
      .setDescription(
        proposals
          .slice(0, 10) // Limit to 10
          .map(
            (p, i) =>
              `**${i + 1}.** ${p.title}\n` +
              `   Type: ${p.type} | ID: \`${p.proposalId.slice(0, 20)}...\``
          )
          .join("\n\n")
      )
      .setFooter({
        text: `Showing ${Math.min(proposals.length, 10)} of ${proposals.length} proposals`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("[Command] Error listing proposals:", error);
    await interaction.editReply({
      content: "Failed to fetch proposals. Please try again.",
    });
  }
}
