"use strict";
/**
 * Button interaction handler for verification confirmation and vote buttons
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleButtonInteraction = handleButtonInteraction;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const api_1 = require("../api");
/**
 * Handle button interactions
 */
async function handleButtonInteraction(interaction) {
    // Handle start verification button (from delegate channel)
    if (interaction.customId === "START-VERIFICATION") {
        await handleStartVerification(interaction);
        return;
    }
    // Handle verification confirmation button
    if (interaction.customId === "CONFIRM-VERIFICATION") {
        await handleVerificationConfirmation(interaction);
        return;
    }
    // Handle vote buttons (vote_YES_{proposalId}, vote_NO_{proposalId}, vote_ABSTAIN_{proposalId})
    if (interaction.customId.startsWith("vote_")) {
        await handleVoteButton(interaction);
        return;
    }
    // Unknown button - ignore
    console.log(`[Button] Unknown button interaction: ${interaction.customId}`);
}
/**
 * Handle the "Start Verification" button click
 * Generates a verification link and sends it to the user
 */
async function handleStartVerification(interaction) {
    const user = interaction.user;
    // Check if verification frontend URL is configured
    if (!config_1.config.verification.frontendUrl) {
        await interaction.reply({
            content: "❌ Verification is not configured. Please contact an administrator.",
            ephemeral: true,
        });
        return;
    }
    // Generate verification URL with user's Discord ID and username
    const verificationUrl = `${config_1.config.verification.frontendUrl}/verify/${user.id}?username=${encodeURIComponent(user.username)}`;
    // Create embed with instructions
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Verify Your Delegation")
        .setDescription(`Hi **${user.username}**!\n\n` +
        `To participate in governance feedback, you need to verify that you're delegating to this DRep.\n\n` +
        `**Steps:**\n` +
        `1. Click the button below to open the verification page\n` +
        `2. Connect your Cardano wallet\n` +
        `3. If not delegated, delegate to the DRep\n` +
        `4. Click "Verify & Connect to Discord"\n` +
        `5. Return here and click **"I've Verified"** in the delegate channel\n\n` +
        `Your verification link is unique to your Discord account.`)
        .addFields({ name: "DRep", value: config_1.config.drep.id || "Not configured", inline: true }, { name: "Your Discord ID", value: user.id, inline: true })
        .setTimestamp()
        .setFooter({ text: "Cardano Governance Verification" });
    // Create verification button (link to external page)
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel("Open Verification Page")
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(verificationUrl)
        .setEmoji("🔗"));
    // Send ephemeral message (only visible to the user)
    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
    });
    console.log(`[Button] Verification link sent to ${user.username} (${user.id})`);
}
/**
 * Handle vote button clicks
 * Button customId format: vote_{SENTIMENT}_{proposalId}
 * Updates the original message with new vote counts after recording the vote
 */
async function handleVoteButton(interaction) {
    const customId = interaction.customId;
    const parts = customId.split("_");
    // Expected format: vote_YES_proposalId or vote_NO_proposalId or vote_ABSTAIN_proposalId
    if (parts.length < 3) {
        await interaction.reply({
            content: "Invalid vote button. Please try again.",
            ephemeral: true,
        });
        return;
    }
    const rawSentiment = parts[1];
    const sentiment = rawSentiment.toLowerCase();
    const proposalId = parts.slice(2).join("_"); // In case proposalId contains underscores
    // Debug logging
    console.log(`[Button] Parsing customId: "${customId}"`);
    console.log(`[Button] Parts: ${JSON.stringify(parts)}`);
    console.log(`[Button] Raw sentiment: "${rawSentiment}", Parsed sentiment: "${sentiment}"`);
    if (!["yes", "no", "abstain"].includes(sentiment)) {
        await interaction.reply({
            content: "Invalid vote type. Please try again.",
            ephemeral: true,
        });
        return;
    }
    const user = interaction.user;
    const guild = interaction.guild;
    const channel = interaction.channel;
    if (!guild || !channel) {
        await interaction.reply({
            content: "This button can only be used in a server.",
            ephemeral: true,
        });
        return;
    }
    try {
        // Submit the reaction to the API and get updated vote counts
        const result = await api_1.apiClient.submitReaction({
            proposalId,
            drepId: config_1.config.drep.id,
            guildId: guild.id,
            guildName: guild.name,
            channelId: channel.id,
            channelName: "name" in channel ? (channel.name ?? "thread") : "thread",
            discordUserId: user.id,
            discordUsername: user.username,
            sentiment,
            action: "add",
        });
        const vote = result.vote;
        // Get the original embed from the message
        const originalEmbed = interaction.message?.embeds[0]?.data;
        if (vote && originalEmbed) {
            // Update the original message with new vote counts (preserving the embed)
            await interaction.update({
                content: `\n\n✅ Yes: ${vote.yes} ❌ No: ${vote.no} ❓ Abstain: ${vote.abstain}\n\n`,
                embeds: [originalEmbed],
            });
        }
        else {
            // Fallback if no embed found - just update content
            await interaction.update({
                content: `\n\n✅ Yes: ${vote.yes} ❌ No: ${vote.no} ❓ Abstain: ${vote.abstain}\n\n`,
            });
        }
        console.log(`[Button] Vote recorded: ${user.username} voted ${sentiment} on ${proposalId.slice(0, 20)}... (Yes: ${vote.yes}, No: ${vote.no}, Abstain: ${vote.abstain})`);
    }
    catch (error) {
        console.error("[Button] Error recording vote:", error);
        // Reply with error message (ephemeral so only the user sees it)
        const errorMessage = error.response?.data?.message || "Failed to record your vote. Please try again.";
        await interaction.reply({
            content: `❌ ${errorMessage}`,
            ephemeral: true,
        });
    }
}
/**
 * Handle the "I've Verified" button click
 * Checks with backend API if user is verified, then grants role
 */
async function handleVerificationConfirmation(interaction) {
    const user = interaction.user;
    const member = interaction.member;
    if (!member) {
        await interaction.reply({
            content: "Could not find your server membership. Please try again.",
            ephemeral: true,
        });
        return;
    }
    // Defer reply while we check verification status
    await interaction.deferReply({ ephemeral: true });
    try {
        // Check verification status with backend API
        const result = await api_1.apiClient.checkDelegator(config_1.config.drep.id, user.id);
        if (!result.success) {
            await interaction.editReply({
                content: `Verification check failed: ${result.message}`,
            });
            return;
        }
        if (!result.verified) {
            // User is not verified - prompt them to complete verification
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xff6b6b)
                .setTitle("Verification Not Complete")
                .setDescription("It looks like you haven't completed the verification process yet.\n\n" +
                "**Please make sure you:**\n" +
                "1. Connected your Cardano wallet on the verification page\n" +
                "2. Delegated to this DRep (if not already)\n" +
                "3. Clicked the **\"Verify & Connect to Discord\"** button\n\n" +
                "After completing these steps, click the **\"I've Verified\"** button again.")
                .setFooter({ text: "Cardano Governance Verification" });
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // User is verified! Grant the delegated role
        const roleId = config_1.config.roles.delegatedRoleId;
        if (!roleId) {
            console.warn("[Button] ROLE_ID_DELEGATED is not configured");
            await interaction.editReply({
                content: "Verification successful! However, role assignment is not configured. Please contact an administrator.",
            });
            return;
        }
        try {
            // Add the role to the user
            await member.roles.add(roleId);
            // Success embed
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00d26a)
                .setTitle("Verification Complete!")
                .setDescription("You have been verified as a delegator and granted access to governance channels.\n\n" +
                "**Your delegation info:**")
                .addFields({
                name: "Stake Address",
                value: `\`${truncateAddress(result.delegator?.stakeAddress || "Unknown")}\``,
                inline: false,
            }, {
                name: "Live Stake",
                value: formatStake(result.delegator?.liveStake),
                inline: true,
            }, {
                name: "Status",
                value: "✅ Verified",
                inline: true,
            })
                .setFooter({ text: "Cardano Governance Verification" })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            console.log(`[Button] Granted delegated role to ${user.username} (${user.id})`);
        }
        catch (roleError) {
            console.error("[Button] Failed to assign role:", roleError);
            await interaction.editReply({
                content: "Verification successful, but I couldn't assign the role. Please contact an administrator.",
            });
        }
    }
    catch (error) {
        console.error("[Button] Error handling verification confirmation:", error);
        await interaction.editReply({
            content: "An error occurred while checking your verification status. Please try again later.",
        });
    }
}
/**
 * Truncate stake address for display
 */
function truncateAddress(address) {
    if (address.length <= 20)
        return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
}
/**
 * Format stake amount from lovelace to ADA
 */
function formatStake(lovelace) {
    if (!lovelace)
        return "Unknown";
    const ada = parseInt(lovelace) / 1_000_000;
    if (ada >= 1_000_000) {
        return `${(ada / 1_000_000).toFixed(2)}M ADA`;
    }
    if (ada >= 1_000) {
        return `${(ada / 1_000).toFixed(1)}K ADA`;
    }
    return `${ada.toFixed(0)} ADA`;
}
//# sourceMappingURL=buttonHandler.js.map