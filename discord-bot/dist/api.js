"use strict";
/**
 * API client for communicating with the backend
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
class ApiClient {
    client;
    constructor() {
        this.client = axios_1.default.create({
            baseURL: config_1.config.api.baseUrl,
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": config_1.config.api.apiKey,
            },
            timeout: 10000,
        });
    }
    /**
     * Submit sentiment data for a proposal
     */
    async submitSentiment(payload) {
        try {
            await this.client.post("/sentiment", payload);
            console.log(`[API] Sentiment submitted for proposal ${payload.proposalId}`);
        }
        catch (error) {
            console.error(`[API] Failed to submit sentiment:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Submit a single reaction update
     * Returns the updated vote counts for updating the Discord message
     */
    async submitReaction(data) {
        try {
            const response = await this.client.post("/sentiment/reaction", data);
            console.log(`[API] Reaction ${data.action}: ${data.sentiment} from ${data.discordUsername}`);
            return {
                vote: response.data.vote || { yes: 0, no: 0, abstain: 0 },
            };
        }
        catch (error) {
            console.error(`[API] Failed to submit reaction:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Submit a comment
     */
    async submitComment(data) {
        try {
            await this.client.post("/sentiment/comment", data);
            console.log(`[API] Comment submitted from ${data.discordUsername}`);
        }
        catch (error) {
            console.error(`[API] Failed to submit comment:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Fetch active governance proposals
     */
    async getActiveProposals() {
        try {
            const response = await this.client.get("/overview/proposals?status=active");
            return response.data;
        }
        catch (error) {
            console.error(`[API] Failed to fetch proposals:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Register a Discord guild (server) with a DRep
     */
    async registerGuild(data) {
        try {
            await this.client.post("/sentiment/register-guild", data);
            console.log(`[API] Guild ${data.guildName} registered for DRep ${data.drepId}`);
        }
        catch (error) {
            console.error(`[API] Failed to register guild:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Check if a Discord user is a verified delegator
     * Used to confirm verification before granting role
     */
    async checkDelegator(drepId, discordUserId) {
        try {
            const response = await this.client.get("/sentiment/delegator/check", {
                params: { drepId, discordUserId },
            });
            return response.data;
        }
        catch (error) {
            console.error(`[API] Failed to check delegator:`, error.response?.data || error.message);
            return {
                success: false,
                verified: false,
                message: error.response?.data?.message || "Failed to check verification status",
            };
        }
    }
    /**
     * Create a proposal post record
     * Called after creating a forum thread for a proposal
     */
    async createProposalPost(data) {
        try {
            const response = await this.client.post("/sentiment/proposal-post", data);
            console.log(`[API] Proposal post created for ${data.proposalId}`);
            return response.data;
        }
        catch (error) {
            console.error(`[API] Failed to create proposal post:`, error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.message || "Failed to create proposal post",
            };
        }
    }
    /**
     * Get all proposal posts for a guild
     * Used to check which proposals have already been posted
     */
    async getProposalPosts(guildId, drepId) {
        try {
            const response = await this.client.get(`/sentiment/proposal-post/${guildId}/${drepId}`);
            return response.data;
        }
        catch (error) {
            console.error(`[API] Failed to get proposal posts:`, error.response?.data || error.message);
            return {
                success: false,
                posts: [],
                count: 0,
            };
        }
    }
    /**
     * Get proposal ID by thread ID
     * Used for comment collection - looks up proposalId from GuildProposalPost
     */
    async getProposalByThreadId(threadId, drepId) {
        try {
            const response = await this.client.get("/sentiment/proposal-post/by-thread", {
                params: { threadId, drepId },
            });
            return {
                success: true,
                proposalId: response.data.proposalId || null,
            };
        }
        catch (error) {
            // 404 is expected if thread is not a proposal post
            if (error.response?.status === 404) {
                return {
                    success: true,
                    proposalId: null,
                };
            }
            console.error(`[API] Failed to get proposal by thread ID:`, error.response?.data || error.message);
            return {
                success: false,
                proposalId: null,
            };
        }
    }
    /**
     * Check if a specific proposal has been posted to a guild
     */
    async checkProposalPost(guildId, drepId, proposalId) {
        try {
            const response = await this.client.get("/sentiment/proposal-post/check", {
                params: { guildId, drepId, proposalId },
            });
            return response.data;
        }
        catch (error) {
            console.error(`[API] Failed to check proposal post:`, error.response?.data || error.message);
            return {
                success: false,
                posted: false,
            };
        }
    }
}
exports.apiClient = new ApiClient();
//# sourceMappingURL=api.js.map