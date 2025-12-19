/**
 * Delegate Channel Utilities
 * Handles posting and updating the verification message in the delegate channel
 */
import { Client } from "discord.js";
/**
 * Delegate channel message text
 */
export declare const DELEGATE_TEXT: {
    TITLE: string;
    DESCRIPTION: string;
};
/**
 * Generate or update the delegate channel message with verification button
 * Posts a new message or edits the existing one
 */
export declare function generateDelegateChannelMessage(client: Client): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=delegateChannel.d.ts.map