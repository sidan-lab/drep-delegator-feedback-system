/**
 * Scheduled task for syncing governance proposals to Discord forum
 * Runs daily (configurable via CRON_PROPOSAL_SYNC env var)
 */
import { Client } from "discord.js";
/**
 * Initialize the proposal sync cron job
 */
export declare function initProposalSync(client: Client): void;
/**
 * Run proposal sync manually (e.g., on bot startup or via command)
 */
export declare function runManualSync(client: Client): Promise<{
    success: boolean;
    message: string;
    posted: number;
    failed: number;
}>;
//# sourceMappingURL=proposalSync.d.ts.map