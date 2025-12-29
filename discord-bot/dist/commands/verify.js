"use strict";
/**
 * Slash command for delegator verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCommand = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
exports.verifyCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("verify")
        .setDescription("Get a link to verify your DRep delegation and connect your wallet"),
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        // Check if verification frontend URL is configured
        if (!config_1.config.verification.frontendUrl) {
            await interaction.reply({
                content: "Verification is not configured. Please contact an administrator.",
                ephemeral: true,
            });
            return;
        }
        // Generate verification URL with user's Discord ID and username
        const verificationUrl = `${config_1.config.verification.frontendUrl}/verify/${userId}?username=${encodeURIComponent(username)}`;
        // Create embed with instructions
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Verify Your Delegation")
            .setDescription(`Hi **${username}**!\n\n` +
            `To participate in governance feedback, you need to verify that you're delegating to this DRep.\n\n` +
            `**Steps:**\n` +
            `1. Click the button below to open the verification page\n` +
            `2. Connect your Cardano wallet\n` +
            `3. If not delegated, delegate to the DRep\n` +
            `4. Click "Verify & Connect to Discord"\n` +
            `5. Return here and confirm your verification\n\n` +
            `Your verification link is unique to your Discord account.`)
            .addFields({ name: "DRep", value: config_1.config.drep.id || "Not configured", inline: true }, { name: "Your Discord ID", value: userId, inline: true })
            .setTimestamp()
            .setFooter({ text: "Cardano Governance Verification" });
        // Create verification button
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setLabel("Verify My Delegation")
            .setStyle(discord_js_1.ButtonStyle.Link)
            .setURL(verificationUrl), new discord_js_1.ButtonBuilder()
            .setCustomId("CONFIRM-VERIFICATION")
            .setLabel("I've Verified")
            .setStyle(discord_js_1.ButtonStyle.Success));
        // Send ephemeral message (only visible to the user)
        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true,
        });
        console.log(`[Command] Verification link sent to ${username} (${userId})`);
    },
};
//# sourceMappingURL=verify.js.map