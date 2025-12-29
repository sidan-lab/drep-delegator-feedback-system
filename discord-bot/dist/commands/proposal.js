"use strict";
/**
 * Slash command for managing governance proposals in Discord forum
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.proposalCommand = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const api_1 = require("../api");
const proposalSync_1 = require("../scheduled/proposalSync");
/**
 * Create an embed for a proposal
 */
function createProposalEmbed(proposal) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(proposal.title || "Governance Proposal")
        .setURL(`https://gov.tools/governance_actions/${proposal.proposalId}`)
        .setDescription(`**Proposal ID:** \`${proposal.proposalId}\`\n\n` +
        (proposal.description
            ? `${proposal.description.slice(0, 500)}${proposal.description.length > 500 ? "..." : ""}\n\n`
            : "") +
        `Vote below to share your sentiment on this proposal!`)
        .addFields({ name: "Type", value: proposal.type || "Unknown", inline: true }, { name: "Status", value: proposal.status || "Active", inline: true }, { name: "DRep", value: config_1.config.drep.id, inline: true })
        .setTimestamp()
        .setFooter({ text: "Cardano Governance Feedback" });
    return embed;
}
/**
 * Create vote buttons for a proposal
 */
function createVoteButtons(proposalId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`vote_YES_${proposalId}`)
        .setLabel("Yes")
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji("👍"), new discord_js_1.ButtonBuilder()
        .setCustomId(`vote_NO_${proposalId}`)
        .setLabel("No")
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji("👎"), new discord_js_1.ButtonBuilder()
        .setCustomId(`vote_ABSTAIN_${proposalId}`)
        .setLabel("Abstain")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji("🤔"));
}
exports.proposalCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("proposal")
        .setDescription("Manage governance proposal discussions")
        .addSubcommand((subcommand) => subcommand
        .setName("post")
        .setDescription("Post a governance proposal to the forum for community feedback")
        .addStringOption((option) => option
        .setName("proposal_id")
        .setDescription("The governance proposal ID (gov_action... or txHash#certIndex)")
        .setRequired(true))
        .addStringOption((option) => option
        .setName("title")
        .setDescription("Custom title for the proposal (optional)")
        .setRequired(false))
        .addStringOption((option) => option
        .setName("description")
        .setDescription("Custom description for the proposal (optional)")
        .setRequired(false)))
        .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List active governance proposals"))
        .addSubcommand((subcommand) => subcommand
        .setName("sync")
        .setDescription("Manually sync all new proposals to the forum"))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "post":
                await handlePostProposal(interaction);
                break;
            case "list":
                await handleListProposals(interaction);
                break;
            case "sync":
                await handleSyncProposals(interaction);
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
 * Handle posting a single proposal to the forum
 */
async function handlePostProposal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const proposalId = interaction.options.getString("proposal_id", true);
    const customTitle = interaction.options.getString("title");
    const customDescription = interaction.options.getString("description");
    // Check if forum channel is configured
    if (!config_1.config.channels.forumChannelId) {
        await interaction.editReply({
            content: "❌ Forum channel not configured. Please set FORUM_CHANNEL_ID in the bot configuration.",
        });
        return;
    }
    // Get the forum channel
    const forumChannel = interaction.client.channels.cache.get(config_1.config.channels.forumChannelId);
    if (!forumChannel || !(forumChannel instanceof discord_js_1.ForumChannel)) {
        await interaction.editReply({
            content: `❌ Forum channel ${config_1.config.channels.forumChannelId} not found or is not a forum channel.`,
        });
        return;
    }
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply({
            content: "❌ This command must be run in a server.",
        });
        return;
    }
    try {
        // Check if proposal already posted
        const checkResult = await api_1.apiClient.checkProposalPost(guildId, config_1.config.drep.id, proposalId);
        if (checkResult.posted) {
            await interaction.editReply({
                content: `⚠️ This proposal has already been posted to the forum.\nThread ID: ${checkResult.post?.threadId}`,
            });
            return;
        }
        // Create the proposal embed and buttons
        const embed = createProposalEmbed({
            proposalId,
            title: customTitle || undefined,
            description: customDescription || undefined,
        });
        const buttons = createVoteButtons(proposalId);
        // Create the forum thread
        const thread = await forumChannel.threads.create({
            name: customTitle || `Proposal ${proposalId.slice(0, 30)}...`,
            message: {
                content: `📋 **Governance Proposal for Discussion**\n\nUse the buttons below to share your sentiment!`,
                embeds: [embed],
                components: [buttons],
            },
        });
        // Record the post in the database
        const createResult = await api_1.apiClient.createProposalPost({
            guildId,
            drepId: config_1.config.drep.id,
            proposalId,
            threadId: thread.id,
        });
        if (createResult.success) {
            await interaction.editReply({
                content: `✅ Proposal posted successfully!\n📌 Thread: <#${thread.id}>`,
            });
        }
        else {
            await interaction.editReply({
                content: `⚠️ Thread created but failed to record in database: ${createResult.message}\n📌 Thread: <#${thread.id}>`,
            });
        }
        console.log(`[Command] Proposal ${proposalId} posted to forum in ${interaction.guild?.name}`);
    }
    catch (error) {
        console.error("[Command] Error posting proposal:", error);
        await interaction.editReply({
            content: "❌ Failed to post proposal. Please try again.",
        });
    }
}
/**
 * Handle listing active proposals
 */
async function handleListProposals(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const proposals = await api_1.apiClient.getActiveProposals();
        if (proposals.length === 0) {
            await interaction.editReply({
                content: "No active governance proposals found.",
            });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("Active Governance Proposals")
            .setDescription(proposals
            .slice(0, 10)
            .map((p, i) => `**${i + 1}.** ${p.title || "Untitled"}\n` +
            `   Type: ${p.type} | Status: ${p.status}\n` +
            `   ID: \`${p.proposalId.slice(0, 30)}...\``)
            .join("\n\n"))
            .setFooter({
            text: `Showing ${Math.min(proposals.length, 10)} of ${proposals.length} proposals`,
        })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        console.error("[Command] Error listing proposals:", error);
        await interaction.editReply({
            content: "❌ Failed to fetch proposals. Please try again.",
        });
    }
}
/**
 * Handle manual sync of all proposals
 */
async function handleSyncProposals(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const result = await (0, proposalSync_1.runManualSync)(interaction.client);
        if (result.success) {
            await interaction.editReply({
                content: `✅ ${result.message}`,
            });
        }
        else {
            await interaction.editReply({
                content: `❌ Sync failed: ${result.message}`,
            });
        }
    }
    catch (error) {
        console.error("[Command] Error syncing proposals:", error);
        await interaction.editReply({
            content: "❌ Failed to sync proposals. Please try again.",
        });
    }
}
//# sourceMappingURL=proposal.js.map