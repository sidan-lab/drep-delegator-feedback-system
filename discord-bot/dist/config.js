"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
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
function validateConfig() {
    const errors = [];
    // Required Discord configuration
    if (!exports.config.discord.token) {
        errors.push("DISCORD_BOT_TOKEN is required");
    }
    if (!exports.config.discord.clientId) {
        errors.push("DISCORD_CLIENT_ID is required");
    }
    // Required API configuration
    if (!exports.config.api.baseUrl) {
        errors.push("API_BASE_URL is required");
    }
    if (!exports.config.api.apiKey) {
        errors.push("API_KEY is required");
    }
    // Required DRep configuration
    if (!exports.config.drep.id) {
        errors.push("DREP_ID is required");
    }
    // Required cron configuration
    if (!exports.config.cron.proposalSyncSchedule) {
        errors.push("CRON_PROPOSAL_SYNC is required");
    }
    if (errors.length > 0) {
        console.error("Configuration errors:");
        errors.forEach((err) => console.error(`  - ${err}`));
        process.exit(1);
    }
}
//# sourceMappingURL=config.js.map