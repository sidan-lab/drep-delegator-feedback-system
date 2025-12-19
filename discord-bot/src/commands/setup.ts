/**
 * Slash command for bot setup tasks
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { generateDelegateChannelMessage } from "../utils/delegateChannel";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup bot features (Admin only)")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delegate")
        .setDescription("Post or update the verification message in the delegate channel")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "delegate":
        await handleSetupDelegate(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand",
          ephemeral: true,
        });
    }
  },
};

/**
 * Handle the /setup delegate command
 * Posts or updates the verification message in the delegate channel
 */
async function handleSetupDelegate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const result = await generateDelegateChannelMessage(interaction.client);

  if (result.success) {
    await interaction.editReply({
      content: `✅ ${result.message}`,
    });
    console.log(`[Command] /setup delegate executed by ${interaction.user.username}`);
  } else {
    await interaction.editReply({
      content: `❌ ${result.message}`,
    });
  }
}
