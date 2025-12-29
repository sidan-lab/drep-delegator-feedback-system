"use strict";
/**
 * Slash command for bot setup tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCommand = void 0;
const discord_js_1 = require("discord.js");
const delegateChannel_1 = require("../utils/delegateChannel");
exports.setupCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup bot features (Admin only)")
        .addSubcommand((subcommand) => subcommand
        .setName("delegate")
        .setDescription("Post or update the verification message in the delegate channel"))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async execute(interaction) {
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
async function handleSetupDelegate(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const result = await (0, delegateChannel_1.generateDelegateChannelMessage)(interaction.client);
    if (result.success) {
        await interaction.editReply({
            content: `✅ ${result.message}`,
        });
        console.log(`[Command] /setup delegate executed by ${interaction.user.username}`);
    }
    else {
        await interaction.editReply({
            content: `❌ ${result.message}`,
        });
    }
}
//# sourceMappingURL=setup.js.map