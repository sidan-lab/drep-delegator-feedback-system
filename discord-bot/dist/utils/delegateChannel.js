"use strict";
/**
 * Delegate Channel Utilities
 * Handles posting and updating the verification message in the delegate channel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELEGATE_TEXT = void 0;
exports.generateDelegateChannelMessage = generateDelegateChannelMessage;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
/**
 * Delegate channel message text
 */
exports.DELEGATE_TEXT = {
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
async function generateDelegateChannelMessage(client) {
    const delegateChannelId = config_1.config.channels.delegateChannelId;
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
        if (!(delegateChannel instanceof discord_js_1.TextChannel)) {
            return {
                success: false,
                message: "Delegate channel is not a text channel",
            };
        }
        // Create the verification embed
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(exports.DELEGATE_TEXT.TITLE)
            .setDescription(exports.DELEGATE_TEXT.DESCRIPTION)
            .addFields({ name: "DRep", value: config_1.config.drep.id || "Not configured", inline: true })
            .setFooter({ text: "Cardano Governance Verification" })
            .setTimestamp();
        // Create the verification button row
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId("START-VERIFICATION")
            .setLabel("Start Verification")
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji("🔗"), new discord_js_1.ButtonBuilder()
            .setCustomId("CONFIRM-VERIFICATION")
            .setLabel("I've Verified")
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji("✅"));
        // Try to find the latest bot message in the channel
        const messages = await delegateChannel.messages.fetch({ limit: 10 });
        const botMessage = messages.find((msg) => msg.author.id === client.user?.id && msg.embeds.length > 0);
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
        }
        else {
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
    }
    catch (error) {
        console.error("[Delegate] Error generating delegate channel message:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
//# sourceMappingURL=delegateChannel.js.map