/**
 * API client for communicating with the backend
 */

import axios, { AxiosInstance } from "axios";
import { config } from "./config";
import type { ProposalSentimentPayload } from "./types";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.api.apiKey,
      },
      timeout: 10000,
    });
  }

  /**
   * Submit sentiment data for a proposal
   */
  async submitSentiment(payload: ProposalSentimentPayload): Promise<void> {
    try {
      await this.client.post("/sentiment", payload);
      console.log(`[API] Sentiment submitted for proposal ${payload.proposalId}`);
    } catch (error: any) {
      console.error(
        `[API] Failed to submit sentiment:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Submit a single reaction update
   * Returns the updated vote counts for updating the Discord message
   */
  async submitReaction(data: {
    proposalId: string;
    drepId: string;
    guildId: string;
    guildName: string;
    channelId: string;
    channelName: string;
    discordUserId: string;
    discordUsername: string;
    sentiment: "yes" | "no" | "abstain";
    action: "add" | "remove";
  }): Promise<{ vote: { yes: number; no: number; abstain: number } }> {
    try {
      const response = await this.client.post("/sentiment/reaction", data);
      console.log(
        `[API] Reaction ${data.action}: ${data.sentiment} from ${data.discordUsername}`
      );
      return {
        vote: response.data.vote || { yes: 0, no: 0, abstain: 0 },
      };
    } catch (error: any) {
      console.error(
        `[API] Failed to submit reaction:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Submit a comment
   * Note: Comments do not affect vote sentiment - only button clicks count as votes
   */
  async submitComment(data: {
    proposalId: string;
    drepId: string;
    guildId: string;
    guildName: string;
    channelId: string;
    channelName: string;
    discordUserId: string;
    discordUsername: string;
    content: string;
    messageId: string;
  }): Promise<void> {
    try {
      await this.client.post("/sentiment/comment", data);
      console.log(`[API] Comment submitted from ${data.discordUsername}`);
    } catch (error: any) {
      console.error(
        `[API] Failed to submit comment:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Fetch active governance proposals
   */
  async getActiveProposals(): Promise<
    Array<{
      proposalId: string;
      hash: string;
      title: string;
      description?: string;
      rationale?: string;
      type: string;
      status: string;
      submissionEpoch?: number;
    }>
  > {
    try {
      const response = await this.client.get("/overview/proposals?status=active");
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to fetch proposals:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Register a Discord guild (server) with a DRep
   */
  async registerGuild(data: {
    guildId: string;
    guildName: string;
    drepId: string;
    governanceChannelId?: string;
  }): Promise<void> {
    try {
      await this.client.post("/sentiment/register-guild", data);
      console.log(`[API] Guild ${data.guildName} registered for DRep ${data.drepId}`);
    } catch (error: any) {
      console.error(
        `[API] Failed to register guild:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Check if a Discord user is a verified delegator
   * Used to confirm verification before granting role
   */
  async checkDelegator(
    drepId: string,
    discordUserId: string
  ): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
    delegator?: {
      discordUserId: string;
      discordUsername: string;
      stakeAddress: string;
      liveStake: string | null;
      isActive: boolean;
    };
  }> {
    try {
      const response = await this.client.get("/sentiment/delegator/check", {
        params: { drepId, discordUserId },
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to check delegator:`,
        error.response?.data || error.message
      );
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
  async createProposalPost(data: {
    guildId: string;
    drepId: string;
    proposalId: string;
    threadId: string;
  }): Promise<{
    success: boolean;
    message: string;
    proposalPost?: {
      id: string;
      guildId: string;
      drepId: string;
      proposalId: string;
      threadId: string;
      postedAt: string;
    };
  }> {
    try {
      const response = await this.client.post("/sentiment/proposal-post", data);
      console.log(`[API] Proposal post created for ${data.proposalId}`);
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to create proposal post:`,
        error.response?.data || error.message
      );
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
  async getProposalPosts(
    guildId: string,
    drepId: string
  ): Promise<{
    success: boolean;
    posts: Array<{
      id: string;
      proposalId: string;
      threadId: string;
      postedAt: string;
    }>;
    count: number;
  }> {
    try {
      const response = await this.client.get(
        `/sentiment/proposal-post/${guildId}/${drepId}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to get proposal posts:`,
        error.response?.data || error.message
      );
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
  async getProposalByThreadId(
    threadId: string,
    drepId: string
  ): Promise<{ success: boolean; proposalId: string | null }> {
    try {
      const response = await this.client.get("/sentiment/proposal-post/by-thread", {
        params: { threadId, drepId },
      });
      return {
        success: true,
        proposalId: response.data.proposalId || null,
      };
    } catch (error: any) {
      // 404 is expected if thread is not a proposal post
      if (error.response?.status === 404) {
        return {
          success: true,
          proposalId: null,
        };
      }
      console.error(
        `[API] Failed to get proposal by thread ID:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        proposalId: null,
      };
    }
  }

  /**
   * Check if a specific proposal has been posted to a guild
   */
  async checkProposalPost(
    guildId: string,
    drepId: string,
    proposalId: string
  ): Promise<{
    success: boolean;
    posted: boolean;
    post?: {
      id: string;
      threadId: string;
      postedAt: string;
    };
  }> {
    try {
      const response = await this.client.get("/sentiment/proposal-post/check", {
        params: { guildId, drepId, proposalId },
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to check proposal post:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        posted: false,
      };
    }
  }

  /**
   * Get pending DRep vote notifications
   * Returns GuildProposalPosts where a DRep has voted but Discord hasn't been notified
   */
  async getPendingDrepVoteNotifications(drepId?: string): Promise<{
    success: boolean;
    notifications: Array<{
      id: string;
      guildId: string;
      drepId: string;
      proposalId: string;
      threadId: string;
      drepVote: "YES" | "NO" | "ABSTAIN";
      drepRationaleUrl: string | null;
      drepVoteTxHash: string | null;
      drepVotedAt: string | null;
    }>;
    count: number;
  }> {
    try {
      const params = drepId ? { drepId } : {};
      const response = await this.client.get(
        "/sentiment/pending-drep-vote-notifications",
        { params }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to get pending DRep vote notifications:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        notifications: [],
        count: 0,
      };
    }
  }

  /**
   * Mark a DRep vote notification as sent to Discord
   */
  async markDrepVoteNotified(postId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await this.client.post("/sentiment/mark-drep-vote-notified", {
        postId,
      });
      console.log(`[API] DRep vote notification marked as sent for post ${postId}`);
      return response.data;
    } catch (error: any) {
      console.error(
        `[API] Failed to mark DRep vote notified:`,
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || "Failed to mark notification as sent",
      };
    }
  }
}

export const apiClient = new ApiClient();
