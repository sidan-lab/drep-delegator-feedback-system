/**
 * Types for Discord bot sentiment collection
 */
export type SentimentType = "yes" | "no" | "abstain";
export interface SentimentReaction {
    discordUserId: string;
    discordUsername: string;
    sentiment: SentimentType;
    timestamp: Date;
}
export interface SentimentComment {
    discordUserId: string;
    discordUsername: string;
    content: string;
    sentiment?: SentimentType;
    timestamp: Date;
    messageId: string;
}
export interface ProposalSentimentPayload {
    proposalId: string;
    drepId: string;
    guildId: string;
    guildName: string;
    channelId: string;
    channelName: string;
    reactions?: SentimentReaction[];
    comments?: SentimentComment[];
}
export interface ProposalMessage {
    messageId: string;
    channelId: string;
    proposalId: string;
    createdAt: Date;
}
export interface GuildConfig {
    guildId: string;
    guildName: string;
    governanceChannelId?: string;
    drepId: string;
    isActive: boolean;
}
//# sourceMappingURL=types.d.ts.map