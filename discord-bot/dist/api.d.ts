/**
 * API client for communicating with the backend
 */
import type { ProposalSentimentPayload } from "./types";
declare class ApiClient {
    private client;
    constructor();
    /**
     * Submit sentiment data for a proposal
     */
    submitSentiment(payload: ProposalSentimentPayload): Promise<void>;
    /**
     * Submit a single reaction update
     * Returns the updated vote counts for updating the Discord message
     */
    submitReaction(data: {
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
    }): Promise<{
        vote: {
            yes: number;
            no: number;
            abstain: number;
        };
    }>;
    /**
     * Submit a comment
     * Note: Comments do not affect vote sentiment - only button clicks count as votes
     */
    submitComment(data: {
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
    }): Promise<void>;
    /**
     * Fetch active governance proposals
     */
    getActiveProposals(): Promise<Array<{
        proposalId: string;
        hash: string;
        title: string;
        description?: string;
        rationale?: string;
        type: string;
        status: string;
        submissionEpoch?: number;
    }>>;
    /**
     * Register a Discord guild (server) with a DRep
     */
    registerGuild(data: {
        guildId: string;
        guildName: string;
        drepId: string;
        governanceChannelId?: string;
    }): Promise<void>;
    /**
     * Check if a Discord user is a verified delegator
     * Used to confirm verification before granting role
     */
    checkDelegator(drepId: string, discordUserId: string): Promise<{
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
    }>;
    /**
     * Create a proposal post record
     * Called after creating a forum thread for a proposal
     */
    createProposalPost(data: {
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
    }>;
    /**
     * Get all proposal posts for a guild
     * Used to check which proposals have already been posted
     */
    getProposalPosts(guildId: string, drepId: string): Promise<{
        success: boolean;
        posts: Array<{
            id: string;
            proposalId: string;
            threadId: string;
            postedAt: string;
        }>;
        count: number;
    }>;
    /**
     * Get proposal ID by thread ID
     * Used for comment collection - looks up proposalId from GuildProposalPost
     */
    getProposalByThreadId(threadId: string, drepId: string): Promise<{
        success: boolean;
        proposalId: string | null;
    }>;
    /**
     * Check if a specific proposal has been posted to a guild
     */
    checkProposalPost(guildId: string, drepId: string, proposalId: string): Promise<{
        success: boolean;
        posted: boolean;
        post?: {
            id: string;
            threadId: string;
            postedAt: string;
        };
    }>;
    /**
     * Get pending DRep vote notifications
     * Returns GuildProposalPosts where a DRep has voted but Discord hasn't been notified
     */
    getPendingDrepVoteNotifications(drepId?: string): Promise<{
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
    }>;
    /**
     * Mark a DRep vote notification as sent to Discord
     */
    markDrepVoteNotified(postId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const apiClient: ApiClient;
export {};
//# sourceMappingURL=api.d.ts.map