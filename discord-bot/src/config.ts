import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Discord Configuration
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
  },

  // Role Configuration
  roles: {
    delegatedRoleId: process.env.ROLE_ID_DELEGATED,
  },

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL,
    apiKey: process.env.API_KEY,
  },

  // DRep Configuration
  drep: {
    id: process.env.DREP_ID,
  },

  // Channel Configuration
  channels: {
    delegateChannelId: process.env.DELEGATE_CHANNEL_ID, // Text channel for verification button
    forumChannelId: process.env.FORUM_CHANNEL_ID, // Forum channel for proposal threads
  },

  // Cron Configuration
  cron: {
    proposalSyncSchedule: process.env.CRON_PROPOSAL_SYNC,
  },

  // Verification Frontend Configuration
  verification: {
    frontendUrl: process.env.VERIFICATION_FRONTEND_URL,
  },

  // Shared Frontend Configuration (for proposal details links)
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL,
  },
};

export function validateConfig(): void {
  const errors: string[] = [];

  // Required Discord configuration
  if (!config.discord.token) {
    errors.push("DISCORD_BOT_TOKEN is required");
  }

  if (!config.discord.clientId) {
    errors.push("DISCORD_CLIENT_ID is required");
  }

  // Required API configuration
  if (!config.api.baseUrl) {
    errors.push("API_BASE_URL is required");
  }

  if (!config.api.apiKey) {
    errors.push("API_KEY is required");
  }

  // Required DRep configuration
  if (!config.drep.id) {
    errors.push("DREP_ID is required");
  }

  // Required cron configuration
  if (!config.cron.proposalSyncSchedule) {
    errors.push("CRON_PROPOSAL_SYNC is required");
  }

  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
