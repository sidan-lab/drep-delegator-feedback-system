"use strict";
/**
 * Discord Bot for DRep Delegator Sentiment Collection
 */
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const commands_1 = require("./commands");
const messageHandler_1 = require("./events/messageHandler");
const buttonHandler_1 = require("./events/buttonHandler");
const proposalSync_1 = require("./scheduled/proposalSync");
// Validate configuration before starting
(0, config_1.validateConfig)();
// Create Discord client with required intents
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
    partials: [
        discord_js_1.Partials.Message,
        discord_js_1.Partials.Channel,
        discord_js_1.Partials.User,
    ],
});
// Store commands in a collection
const commandCollection = new discord_js_1.Collection();
commands_1.commands.forEach((cmd) => {
    commandCollection.set(cmd.data.name, cmd);
});
// Register slash commands
async function registerCommands() {
    const rest = new discord_js_1.REST({ version: "10" }).setToken(config_1.config.discord.token);
    try {
        console.log("[Bot] Refreshing application (/) commands...");
        const commandData = commands_1.commands.map((cmd) => cmd.data.toJSON());
        await rest.put(discord_js_1.Routes.applicationCommands(config_1.config.discord.clientId), {
            body: commandData,
        });
        console.log("[Bot] Successfully registered application commands");
    }
    catch (error) {
        console.error("[Bot] Error registering commands:", error);
    }
}
// Event: Bot ready
client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
    console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
    console.log(`[Bot] Serving ${readyClient.guilds.cache.size} guild(s)`);
    console.log(`[Bot] DRep ID: ${config_1.config.drep.id}`);
    // Register slash commands
    await registerCommands();
    // Initialize proposal sync cron job
    if (config_1.config.channels.forumChannelId) {
        (0, proposalSync_1.initProposalSync)(client);
        console.log(`[Bot] Proposal sync initialized for forum channel: ${config_1.config.channels.forumChannelId}`);
    }
    else {
        console.log(`[Bot] FORUM_CHANNEL_ID not set - proposal sync disabled`);
    }
});
// Event: Interaction (slash commands and buttons)
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        try {
            await (0, buttonHandler_1.handleButtonInteraction)(interaction);
        }
        catch (error) {
            console.error(`[Bot] Error handling button interaction:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "An error occurred. Please try again.",
                    ephemeral: true,
                });
            }
        }
        return;
    }
    // Handle slash commands
    if (!interaction.isChatInputCommand())
        return;
    const command = commandCollection.get(interaction.commandName);
    if (!command) {
        console.warn(`[Bot] Unknown command: ${interaction.commandName}`);
        return;
    }
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(`[Bot] Error executing command ${interaction.commandName}:`, error);
        const errorMessage = "There was an error executing this command.";
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        }
        else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});
// Event: New message (for comments on proposal threads)
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    await (0, messageHandler_1.handleMessage)(message);
});
// Event: Guild joined
client.on(discord_js_1.Events.GuildCreate, (guild) => {
    console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
});
// Event: Guild left
client.on(discord_js_1.Events.GuildDelete, (guild) => {
    console.log(`[Bot] Left guild: ${guild.name} (${guild.id})`);
});
// Error handling
client.on(discord_js_1.Events.Error, (error) => {
    console.error("[Bot] Client error:", error);
});
process.on("unhandledRejection", (error) => {
    console.error("[Bot] Unhandled promise rejection:", error);
});
// Start the bot
console.log("[Bot] Starting Discord bot...");
client.login(config_1.config.discord.token);
//# sourceMappingURL=index.js.map