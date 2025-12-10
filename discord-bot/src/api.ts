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
      await this.client.post("/api/sentiment", payload);
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
  }): Promise<void> {
    try {
      await this.client.post("/api/sentiment/reaction", data);
      console.log(
        `[API] Reaction ${data.action}: ${data.sentiment} from ${data.discordUsername}`
      );
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
    sentiment?: "yes" | "no" | "abstain";
  }): Promise<void> {
    try {
      await this.client.post("/api/sentiment/comment", data);
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
      type: string;
      status: string;
    }>
  > {
    try {
      const response = await this.client.get("/api/proposals?status=active");
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
      await this.client.post("/api/sentiment/register-guild", data);
      console.log(`[API] Guild ${data.guildName} registered for DRep ${data.drepId}`);
    } catch (error: any) {
      console.error(
        `[API] Failed to register guild:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
