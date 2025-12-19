"use strict";
/**
 * Handle message events for comment collection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const config_1 = require("../config");
const api_1 = require("../api");
/**
 * Get proposal ID from thread using database lookup
 * This is the primary method - uses GuildProposalPost table to map threadId to proposalId
 */
async function getProposalIdFromThreadLookup(message) {
    // Check if in a thread
    if (!message.channel.isThread())
        return null;
    try {
        // Look up the proposalId from the GuildProposalPost table using threadId
        const result = await api_1.apiClient.getProposalByThreadId(message.channel.id, config_1.config.drep.id);
        if (result.success && result.proposalId) {
            return result.proposalId;
        }
        return null;
    }
    catch (error) {
        console.error("[Message] Error looking up proposal by thread ID:", error);
        return null;
    }
}
/**
 * Check if message is in a proposal thread by checking embed footer
 * This is used as a quick check before making the API call
 */
async function isProposalThread(message) {
    if (!message.channel.isThread())
        return false;
    try {
        const starterMessage = await message.channel.fetchStarterMessage();
        if (!starterMessage)
            return false;
        if (!starterMessage.embeds || starterMessage.embeds.length === 0)
            return false;
        const embed = starterMessage.embeds[0];
        return embed.footer?.text === "Cardano Governance Feedback";
    }
    catch (error) {
        return false;
    }
}
/**
 * Detect sentiment from message content (basic keyword analysis)
 */
function detectSentiment(content) {
    const lowerContent = content.toLowerCase();
    // Check for explicit sentiment indicators
    const yesIndicators = [
        "i support",
        "i agree",
        "yes",
        "in favor",
        "approve",
        "+1",
        "thumbs up",
        "good proposal",
        "great idea",
    ];
    const noIndicators = [
        "i oppose",
        "i disagree",
        "no",
        "against",
        "reject",
        "-1",
        "thumbs down",
        "bad proposal",
        "terrible idea",
    ];
    const abstainIndicators = [
        "abstain",
        "neutral",
        "undecided",
        "not sure",
        "need more info",
        "on the fence",
    ];
    for (const indicator of yesIndicators) {
        if (lowerContent.includes(indicator))
            return "yes";
    }
    for (const indicator of noIndicators) {
        if (lowerContent.includes(indicator))
            return "no";
    }
    for (const indicator of abstainIndicators) {
        if (lowerContent.includes(indicator))
            return "abstain";
    }
    return undefined;
}
/**
 * Handle new message event
 */
async function handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot)
        return;
    // Ignore empty messages
    if (!message.content.trim())
        return;
    try {
        // Quick check: is this a proposal thread? (check embed footer)
        if (!await isProposalThread(message))
            return;
        // Look up proposalId using thread ID from database
        const proposalId = await getProposalIdFromThreadLookup(message);
        // Not related to a proposal (not in our GuildProposalPost table)
        if (!proposalId)
            return;
        // Get guild info
        const guild = message.guild;
        if (!guild)
            return;
        const channel = message.channel;
        // Detect sentiment from message content
        const sentiment = detectSentiment(message.content);
        // Submit comment to API
        await api_1.apiClient.submitComment({
            proposalId,
            drepId: config_1.config.drep.id,
            guildId: guild.id,
            guildName: guild.name,
            channelId: channel.id,
            channelName: "name" in channel ? (channel.name ?? "unknown") : "unknown",
            discordUserId: message.author.id,
            discordUsername: message.author.username,
            content: message.content,
            messageId: message.id,
            sentiment,
        });
        console.log(`[Message] Comment collected from ${message.author.username} on proposal ${proposalId}` +
            (sentiment ? ` (sentiment: ${sentiment})` : ""));
    }
    catch (error) {
        console.error("[Message] Error handling message:", error);
    }
}
//# sourceMappingURL=messageHandler.js.map