/**
 * Discord Bot for DRep Delegator Sentiment Collection
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  Collection,
} from "discord.js";
import { config, validateConfig } from "./config";
import { commands } from "./commands";
import { handleReactionAdd, handleReactionRemove } from "./events/reactionHandler";
import { handleMessage } from "./events/messageHandler";

// Validate configuration before starting
validateConfig();

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

// Store commands in a collection
const commandCollection = new Collection<string, any>();
commands.forEach((cmd) => {
  commandCollection.set(cmd.data.name, cmd);
});

// Register slash commands
async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  try {
    console.log("[Bot] Refreshing application (/) commands...");

    const commandData = commands.map((cmd) => cmd.data.toJSON());

    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: commandData,
    });

    console.log("[Bot] Successfully registered application commands");
  } catch (error) {
    console.error("[Bot] Error registering commands:", error);
  }
}

// Event: Bot ready
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
  console.log(`[Bot] Serving ${readyClient.guilds.cache.size} guild(s)`);
  console.log(`[Bot] DRep ID: ${config.drep.id}`);

  // Register slash commands
  await registerCommands();
});

// Event: Interaction (slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandCollection.get(interaction.commandName);

  if (!command) {
    console.warn(`[Bot] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Bot] Error executing command ${interaction.commandName}:`, error);

    const errorMessage = "There was an error executing this command.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Event: Reaction added
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await handleReactionAdd(reaction, user);
});

// Event: Reaction removed
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  await handleReactionRemove(reaction, user);
});

// Event: New message (for comments on proposal threads)
client.on(Events.MessageCreate, async (message) => {
  await handleMessage(message);
});

// Event: Guild joined
client.on(Events.GuildCreate, (guild) => {
  console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
});

// Event: Guild left
client.on(Events.GuildDelete, (guild) => {
  console.log(`[Bot] Left guild: ${guild.name} (${guild.id})`);
});

// Error handling
client.on(Events.Error, (error) => {
  console.error("[Bot] Client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[Bot] Unhandled promise rejection:", error);
});

// Start the bot
console.log("[Bot] Starting Discord bot...");
client.login(config.discord.token);
