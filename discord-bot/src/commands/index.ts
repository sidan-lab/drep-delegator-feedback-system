/**
 * Command registry
 */

import { proposalCommand } from "./proposal";
import { verifyCommand } from "./verify";

export const commands = [proposalCommand, verifyCommand];
