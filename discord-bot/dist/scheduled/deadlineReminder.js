"use strict";
/**
 * Scheduled task for sending deadline reminder notifications
 * Polls the API for pending deadline alerts and sends Discord notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDeadlineReminder = initDeadlineReminder;
exports.stopDeadlineReminder = stopDeadlineReminder;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const api_1 = require("../api");
// Polling interval in milliseconds (10 seconds)
const POLL_INTERVAL = 10 * 1000;
let pollingInterval = null;
let lastLogTime = 0;
/**
 * Get urgency color based on days remaining
 * Red for 1 day, orange for 3 days, yellow for 7+ days
 */
function getUrgencyColor(daysRemaining) {
    if (daysRemaining <= 1)
        return 0xe74c3c; // Red
    if (daysRemaining <= 3)
        return 0xe67e22; // Orange
    return 0xf1c40f; // Yellow
}
/**
 * Get urgency label based on days remaining
 */
function getUrgencyLabel(daysRemaining) {
    if (daysRemaining <= 1)
        return "URGENT";
    if (daysRemaining <= 3)
        return "Soon";
    return "Reminder";
}
/**
 * Format DRep vote for display with emoji
 */
function formatDrepVote(vote) {
    if (!vote)
        return "**Not Yet Voted**";
    switch (vote.toUpperCase()) {
        case "YES":
            return "Yes";
        case "NO":
            return "No";
        case "ABSTAIN":
            return "Abstain";
        default:
            return vote;
    }
}
/**
 * Create an embed for deadline reminder
 */
function createDeadlineEmbed(alert) {
    const daysRemaining = alert.daysBeforeExpiry;
    const urgencyLabel = getUrgencyLabel(daysRemaining);
    const proposal = alert.proposal;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(getUrgencyColor(daysRemaining))
        .setTitle(`${urgencyLabel}: Voting Deadline Reminder`)
        .setDescription(proposal?.title || "Governance Proposal")
        .addFields({
        name: "Time Remaining",
        value: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        inline: true,
    }, {
        name: "DRep Vote Status",
        value: formatDrepVote(alert.drepVote || null),
        inline: true,
    })
        .setFooter({ text: "React with your sentiment on the proposal thread" })
        .setTimestamp();
    if (proposal?.governanceActionType) {
        embed.addFields({
            name: "Type",
            value: formatProposalType(proposal.governanceActionType),
            inline: true,
        });
    }
    return embed;
}
/**
 * Format proposal type for display
 */
function formatProposalType(type) {
    const typeMap = {
        INFO_ACTION: "Info Action",
        TREASURY_WITHDRAWALS: "Treasury Withdrawal",
        NEW_CONSTITUTION: "New Constitution",
        HARD_FORK_INITIATION: "Hard Fork",
        PROTOCOL_PARAMETER_CHANGE: "Parameter Change",
        NO_CONFIDENCE: "No Confidence",
        UPDATE_COMMITTEE: "Update Committee",
    };
    return typeMap[type] || type;
}
/**
 * Send a reminder to a Discord channel (forum thread)
 */
async function sendChannelReminder(client, alert) {
    if (!alert.guildPost?.threadId) {
        console.warn(`[DeadlineReminder] No thread ID for alert ${alert.id}`);
        return false;
    }
    try {
        const thread = await client.channels.fetch(alert.guildPost.threadId);
        if (!thread || !(thread instanceof discord_js_1.ThreadChannel)) {
            console.warn(`[DeadlineReminder] Thread ${alert.guildPost.threadId} not found or is not a thread`);
            return false;
        }
        const embed = createDeadlineEmbed(alert);
        await thread.send({
            content: alert.drepHasVoted
                ? `Voting deadline reminder for this proposal.`
                : `**Reminder:** The DRep hasn't voted on this proposal yet!`,
            embeds: [embed],
        });
        console.log(`[DeadlineReminder] Sent channel reminder to thread ${alert.guildPost.threadId}`);
        return true;
    }
    catch (error) {
        console.error(`[DeadlineReminder] Error sending channel reminder to thread ${alert.guildPost?.threadId}:`, error);
        return false;
    }
}
/**
 * Send a reminder via Discord DM
 */
async function sendDmReminder(client, alert, discordUserId) {
    try {
        // Create DM channel directly without fetching user first
        // This works as long as the bot and user share at least one server
        const dmChannel = await client.users.createDM(discordUserId);
        const embed = createDeadlineEmbed(alert);
        embed.setFooter({
            text: `You can manage notification preferences in the DRep dashboard`,
        });
        await dmChannel.send({
            content: alert.drepHasVoted
                ? `Voting deadline reminder:`
                : `**Action needed:** You haven't voted on this proposal yet!`,
            embeds: [embed],
        });
        console.log(`[DeadlineReminder] Sent DM reminder to user ${discordUserId}`);
        return true;
    }
    catch (error) {
        const discordError = error;
        // Handle specific Discord errors
        if (discordError.code === 50007) {
            console.warn(`[DeadlineReminder] Cannot send DM to user ${discordUserId} - DMs disabled or blocked`);
        }
        else if (discordError.code === 10013) {
            console.warn(`[DeadlineReminder] Cannot send DM to user ${discordUserId} - User not found or bot doesn't share a server with user`);
        }
        else if (discordError.code === 50035) {
            console.warn(`[DeadlineReminder] Cannot send DM to user ${discordUserId} - Invalid user ID format`);
        }
        else {
            console.error(`[DeadlineReminder] Error sending DM to user ${discordUserId}:`, error);
        }
        return false;
    }
}
/**
 * Process pending deadline alerts
 */
async function processPendingAlerts(client) {
    try {
        const drepId = config_1.config.drep.id;
        if (!drepId) {
            return; // No DRep configured
        }
        const result = await api_1.apiClient.getPendingDeadlineAlerts(drepId);
        if (!result.success) {
            console.log(`[DeadlineReminder] Poll check: API call failed`);
            return;
        }
        if (result.alerts.length === 0) {
            // Only log every 5 minutes to avoid spam
            const now = Date.now();
            if (now - lastLogTime > 300000) {
                console.log(`[DeadlineReminder] Poll check: No pending alerts`);
                lastLogTime = now;
            }
            return;
        }
        console.log(`[DeadlineReminder] Processing ${result.alerts.length} pending alert(s)`);
        for (const alert of result.alerts) {
            let success = false;
            let errorMessage;
            if (alert.alertChannel === "DISCORD_CHANNEL") {
                success = await sendChannelReminder(client, alert);
                if (!success) {
                    errorMessage = "Failed to send channel reminder";
                }
            }
            else if (alert.alertChannel === "DISCORD_DM") {
                // Get Discord user ID from notification preferences (not from drepRegistration.discordGuildId)
                const discordUserId = alert.notificationPreference?.discordUserId;
                if (discordUserId) {
                    success = await sendDmReminder(client, alert, discordUserId);
                    if (!success) {
                        errorMessage = "Failed to send DM - user may have DMs disabled";
                    }
                }
                else {
                    errorMessage = "No Discord user ID configured for DM";
                }
            }
            // Mark alert as sent or failed
            await api_1.apiClient.markAlertSent(alert.id, success ? "SENT" : "FAILED", errorMessage);
            // Small delay between alerts to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    catch (error) {
        console.error("[DeadlineReminder] Error processing alerts:", error);
    }
}
/**
 * Initialize the deadline reminder scheduled task
 */
function initDeadlineReminder(client) {
    // Check if DRep ID is configured
    if (!config_1.config.drep.id) {
        console.log("[DeadlineReminder] DREP_ID not configured, deadline reminder disabled");
        return;
    }
    console.log(`[DeadlineReminder] Initializing deadline reminder (polling every ${POLL_INTERVAL / 1000}s)`);
    // Run immediately on startup
    processPendingAlerts(client);
    // Set up polling interval
    pollingInterval = setInterval(() => {
        processPendingAlerts(client);
    }, POLL_INTERVAL);
    console.log("[DeadlineReminder] Deadline reminder initialized");
}
/**
 * Stop the deadline reminder
 */
function stopDeadlineReminder() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log("[DeadlineReminder] Deadline reminder stopped");
    }
}
//# sourceMappingURL=deadlineReminder.js.map