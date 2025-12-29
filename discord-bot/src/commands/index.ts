/**
 * Command registry
 */

import { proposalCommand } from "./proposal";
import { setupCommand } from "./setup";
import { verifyCommand } from "./verify";

export const commands = [proposalCommand, setupCommand, verifyCommand];
