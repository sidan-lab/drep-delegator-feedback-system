/**
 * Scheduled task for sending deadline reminder notifications
 * Polls the API for pending deadline alerts and sends Discord notifications
 */
import { Client } from "discord.js";
/**
 * Initialize the deadline reminder scheduled task
 */
export declare function initDeadlineReminder(client: Client): void;
/**
 * Stop the deadline reminder
 */
export declare function stopDeadlineReminder(): void;
//# sourceMappingURL=deadlineReminder.d.ts.map