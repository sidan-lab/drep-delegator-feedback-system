import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Discord Configuration
  discord: {
    token: process.env.DISCORD_BOT_TOKEN || "",
    clientId: process.env.DISCORD_CLIENT_ID || "",
  },

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
    apiKey: process.env.API_KEY || "",
  },

  // DRep Configuration
  drep: {
    id: process.env.DREP_ID || "",
  },

  // Channel Configuration
  channels: {
    governanceChannelId: process.env.GOVERNANCE_CHANNEL_ID || null,
  },

  // Reaction Configuration (emoji names)
  reactions: {
    yes: process.env.REACTION_YES || "thumbsup",
    no: process.env.REACTION_NO || "thumbsdown",
    abstain: process.env.REACTION_ABSTAIN || "thinking",
  },
};

export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.discord.token) {
    errors.push("DISCORD_BOT_TOKEN is required");
  }

  if (!config.discord.clientId) {
    errors.push("DISCORD_CLIENT_ID is required");
  }

  if (!config.api.apiKey) {
    errors.push("API_KEY is required");
  }

  if (!config.drep.id) {
    errors.push("DREP_ID is required");
  }

  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
