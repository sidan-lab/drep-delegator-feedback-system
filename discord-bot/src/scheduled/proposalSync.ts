/**
 * Scheduled task for syncing governance proposals to Discord forum
 * Runs daily (configurable via CRON_PROPOSAL_SYNC env var)
 */

import cron from "node-cron";
import {
  Client,
  ForumChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { config } from "../config";
import { apiClient } from "../api";

// Tag mapping for governance types (matching API response display labels)
const GOVERNANCE_TAGS: Record<string, { name: string; envKey: string }> = {
  "Protocol Parameter Change": {
    name: "Protocol Parameter Change",
    envKey: "TAG_ID_PARAMETER_CHANGE",
  },
  "Hard Fork Initiation": {
    name: "Hard Fork Initiation",
    envKey: "TAG_ID_HARD_FORK_INITIATION",
  },
  "Treasury Withdrawals": {
    name: "Treasury Withdrawals",
    envKey: "TAG_ID_TREASURY_WITHDRAWALS",
  },
  "No Confidence": { name: "No Confidence", envKey: "TAG_ID_NO_CONFIDENCE" },
  "Update Committee": {
    name: "Update Committee",
    envKey: "TAG_ID_NEW_COMMITTEE",
  },
  "New Constitution": {
    name: "New Constitution",
    envKey: "TAG_ID_NEW_CONSTITUTION",
  },
  "Info Action": { name: "Info Action", envKey: "TAG_ID_INFO_ACTION" },
};

/**
 * Get Discord tag ID for a governance type
 */
function getTagIdForType(governanceType: string): string | undefined {
  const tagConfig = GOVERNANCE_TAGS[governanceType];
  if (!tagConfig) return undefined;
  return process.env[tagConfig.envKey];
}

/**
 * Create an embed for a proposal
 * Displays title, description (abstract), and rationale similar to the reference implementation
 */
function createProposalEmbed(proposal: {
  proposalId: string;
  hash: string;
  title: string;
  type: string;
  status: string;
  description?: string;
  rationale?: string;
}): EmbedBuilder {
  // Get color based on governance type (matching API response display labels)
  const typeColors: Record<string, number> = {
    "Protocol Parameter Change": 0x9b59b6, // Purple
    "Hard Fork Initiation": 0xe74c3c, // Red
    "Treasury Withdrawals": 0xf1c40f, // Yellow/Gold
    "No Confidence": 0xe67e22, // Orange
    "Update Committee": 0x2ecc71, // Green
    "New Constitution": 0x1abc9c, // Teal
    "Info Action": 0x3498db, // Blue
  };

  const color = typeColors[proposal.type] || 0x0099ff;

  // Build description with abstract text in an indented block
  let descriptionText = "";
  if (proposal.description && proposal.description.trim()) {
    // Truncate if too long (Discord embed description limit is 4096 chars)
    const abstract = proposal.description.length > 1500
      ? proposal.description.slice(0, 1500) + "..."
      : proposal.description;
    // Use block quote formatting for indented look
    descriptionText = abstract
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  // Use shared frontend URL if configured, otherwise fall back to adastat
  // Frontend uses /governance/{hash} format, adastat uses /governances/{proposalId}
  const proposalUrl = config.frontend.baseUrl
    ? `${config.frontend.baseUrl}/governance/${proposal.hash}`
    : `https://adastat.net/governances/${proposal.proposalId}`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(proposal.title || "Governance Proposal")
    .setURL(proposalUrl)
    .setDescription(descriptionText || null)
    .setTimestamp()
    .setFooter({ text: "Cardano Governance Feedback" });

  // Add rationale as a separate field if available
  if (proposal.rationale && proposal.rationale.trim()) {
    // Truncate rationale if too long (Discord field value limit is 1024 chars)
    const rationaleText = proposal.rationale.length > 1000
      ? proposal.rationale.slice(0, 1000) + "..."
      : proposal.rationale;
    embed.addFields({
      name: "Rationale",
      value: rationaleText,
      inline: false,
    });
  }

  return embed;
}

/**
 * Create vote buttons for a proposal
 */
function createVoteButtons(
  proposalId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote_YES_${proposalId}`)
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success)
      .setEmoji("👍"),
    new ButtonBuilder()
      .setCustomId(`vote_NO_${proposalId}`)
      .setLabel("No")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("👎"),
    new ButtonBuilder()
      .setCustomId(`vote_ABSTAIN_${proposalId}`)
      .setLabel("Abstain")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🤔")
  );
}

/**
 * Post a proposal to the forum channel
 */
async function postProposalToForum(
  _client: Client,
  forum: ForumChannel,
  proposal: {
    proposalId: string;
    hash: string;
    title: string;
    type: string;
    status: string;
    description?: string;
    rationale?: string;
  }
): Promise<string | null> {
  try {
    const embed = createProposalEmbed(proposal);
    const buttons = createVoteButtons(proposal.proposalId);

    // Vote count display (starts at 0)
    const voteContent = `✅ Yes: 0 ❌ No: 0 ❓ Abstain: 0`;

    // Get governance type tag if available
    const tagId = getTagIdForType(proposal.type);
    const appliedTags: string[] = tagId ? [tagId] : [];

    if (tagId) {
      console.log(`[Sync] Will apply tag ${tagId} for type "${proposal.type}"`);
    } else {
      console.log(
        `[Sync] No tag ID found for type "${proposal.type}" - check env vars and type mapping`
      );
    }

    // Create the forum thread with tags applied during creation
    const thread = await forum.threads.create({
      name: proposal.title || `Proposal ${proposal.proposalId.slice(0, 20)}...`,
      message: {
        content: `\n\n${voteContent}\n\n`,
        embeds: [embed],
        components: [buttons],
      },
      appliedTags,
    });

    console.log(
      `[Sync] Created forum thread "${thread.name}" (${thread.id}) for proposal ${proposal.proposalId}` +
        (appliedTags.length > 0 ? ` with tag ${appliedTags[0]}` : " (no tag)")
    );

    return thread.id;
  } catch (error) {
    console.error(
      `[Sync] Failed to create forum thread for proposal ${proposal.proposalId}:`,
      error
    );
    return null;
  }
}

/**
 * Ensure guild is registered for the DRep
 */
async function ensureGuildRegistered(
  guildId: string,
  guildName: string
): Promise<boolean> {
  try {
    await apiClient.registerGuild({
      guildId,
      guildName,
      drepId: config.drep.id!,
    });
    return true;
  } catch (error: any) {
    // If already registered, that's fine
    if (
      error.response?.status === 409 ||
      error.response?.data?.error?.includes("already")
    ) {
      return true;
    }
    console.error(
      `[Sync] Failed to register guild:`,
      error.response?.data || error.message
    );
    return false;
  }
}

/**
 * Run the proposal sync task
 */
async function runProposalSync(client: Client): Promise<void> {
  console.log("[Sync] Starting proposal sync...");

  // Validate configuration
  if (!config.channels.forumChannelId) {
    console.warn("[Sync] FORUM_CHANNEL_ID not configured, skipping sync");
    return;
  }

  if (!config.drep.id) {
    console.warn("[Sync] DREP_ID not configured, skipping sync");
    return;
  }

  // Get the forum channel
  const forumChannel = client.channels.cache.get(
    config.channels.forumChannelId
  );

  if (!forumChannel || !(forumChannel instanceof ForumChannel)) {
    console.error(
      `[Sync] Forum channel ${config.channels.forumChannelId} not found or is not a forum channel`
    );
    return;
  }

  // Get the guild ID from the forum channel
  const guildId = forumChannel.guildId;
  const guildName = forumChannel.guild.name;

  try {
    // 0. Ensure guild is registered first
    console.log("[Sync] Ensuring guild is registered...");
    const guildRegistered = await ensureGuildRegistered(guildId, guildName);
    if (!guildRegistered) {
      console.error(
        "[Sync] Failed to register guild, cannot proceed with sync"
      );
      return;
    }

    // 1. Fetch active proposals from API
    console.log("[Sync] Fetching active proposals...");
    const proposals = await apiClient.getActiveProposals();
    console.log(`[Sync] Found ${proposals.length} active proposals`);

    if (proposals.length === 0) {
      console.log("[Sync] No active proposals to sync");
      return;
    }

    // 2. Get already posted proposals
    console.log("[Sync] Checking already posted proposals...");
    const postedResult = await apiClient.getProposalPosts(
      guildId,
      config.drep.id!
    );
    const postedProposalIds = new Set(
      postedResult.posts.map((p) => p.proposalId)
    );
    console.log(
      `[Sync] Found ${postedProposalIds.size} already posted proposals`
    );

    // 3. Filter to only new proposals
    const newProposals = proposals.filter(
      (p) => !postedProposalIds.has(p.proposalId)
    );
    console.log(`[Sync] ${newProposals.length} new proposals to post`);

    if (newProposals.length === 0) {
      console.log("[Sync] All proposals already posted");
      return;
    }

    // 4. Sort proposals by submissionEpoch (ascending - oldest first)
    // Oldest proposals get posted first, newest posted last
    // Since Discord shows newest posts at top, most recently submitted will appear at top
    newProposals.sort((a: any, b: any) => {
      const epochA = a.submissionEpoch || 0;
      const epochB = b.submissionEpoch || 0;
      return epochA - epochB;
    });

    console.log("[Sync] Sorted proposals by submissionEpoch (ascending):");
    newProposals.forEach((p: any) => {
      console.log(
        `  - ${p.title?.slice(0, 40)}... (epoch: ${p.submissionEpoch || "N/A"})`
      );
    });

    // 5. Post each new proposal
    let successCount = 0;
    let failCount = 0;

    for (const proposal of newProposals) {
      // Add a small delay between posts to avoid rate limiting
      if (successCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Post to forum
      const threadId = await postProposalToForum(
        client,
        forumChannel,
        proposal
      );

      if (!threadId) {
        failCount++;
        continue;
      }

      // Record the post in the database
      const result = await apiClient.createProposalPost({
        guildId,
        drepId: config.drep.id!,
        proposalId: proposal.proposalId,
        threadId,
      });

      if (result.success) {
        successCount++;
        console.log(`[Sync] Recorded proposal post for ${proposal.proposalId}`);
      } else {
        console.warn(
          `[Sync] Failed to record proposal post for ${proposal.proposalId}: ${result.message}`
        );
        // Still count as success since the thread was created
        successCount++;
      }
    }

    console.log(
      `[Sync] Proposal sync completed: ${successCount} posted, ${failCount} failed`
    );
  } catch (error) {
    console.error("[Sync] Error during proposal sync:", error);
  }
}

/**
 * Initialize the proposal sync cron job
 */
export function initProposalSync(client: Client): void {
  const schedule = config.cron.proposalSyncSchedule;

  // Check if schedule is defined
  if (!schedule) {
    console.error(
      "[Sync] CRON_PROPOSAL_SYNC not configured, proposal sync disabled"
    );
    return;
  }

  console.log(`[Sync] Initializing proposal sync with schedule: ${schedule}`);

  // Validate cron expression
  if (!cron.validate(schedule)) {
    console.error(`[Sync] Invalid cron expression: ${schedule}`);
    return;
  }

  // Schedule the task
  cron.schedule(schedule, async () => {
    console.log(`[Sync] Cron triggered at ${new Date().toISOString()}`);
    await runProposalSync(client);
  });

  console.log("[Sync] Proposal sync cron job initialized");
}

/**
 * Run proposal sync manually (e.g., on bot startup or via command)
 */
export async function runManualSync(client: Client): Promise<{
  success: boolean;
  message: string;
  posted: number;
  failed: number;
}> {
  console.log("[Sync] Running manual proposal sync...");

  // Validate configuration
  if (!config.channels.forumChannelId) {
    return {
      success: false,
      message: "FORUM_CHANNEL_ID not configured",
      posted: 0,
      failed: 0,
    };
  }

  if (!config.drep.id) {
    return {
      success: false,
      message: "DREP_ID not configured",
      posted: 0,
      failed: 0,
    };
  }

  const forumChannel = client.channels.cache.get(
    config.channels.forumChannelId
  );

  if (!forumChannel || !(forumChannel instanceof ForumChannel)) {
    return {
      success: false,
      message: `Forum channel ${config.channels.forumChannelId} not found or is not a forum channel`,
      posted: 0,
      failed: 0,
    };
  }

  const guildId = forumChannel.guildId;
  const guildName = forumChannel.guild.name;

  try {
    // Ensure guild is registered first
    const guildRegistered = await ensureGuildRegistered(guildId, guildName);
    if (!guildRegistered) {
      return {
        success: false,
        message: "Failed to register guild",
        posted: 0,
        failed: 0,
      };
    }

    const proposals = await apiClient.getActiveProposals();
    const postedResult = await apiClient.getProposalPosts(
      guildId,
      config.drep.id!
    );
    const postedProposalIds = new Set(
      postedResult.posts.map((p) => p.proposalId)
    );
    const newProposals = proposals.filter(
      (p) => !postedProposalIds.has(p.proposalId)
    );

    // Sort by submissionEpoch ascending (oldest first, newest last to appear at top)
    newProposals.sort((a: any, b: any) => {
      const epochA = a.submissionEpoch || 0;
      const epochB = b.submissionEpoch || 0;
      return epochA - epochB;
    });

    let posted = 0;
    let failed = 0;

    for (const proposal of newProposals) {
      if (posted > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const threadId = await postProposalToForum(
        client,
        forumChannel,
        proposal
      );

      if (threadId) {
        await apiClient.createProposalPost({
          guildId,
          drepId: config.drep.id!,
          proposalId: proposal.proposalId,
          threadId,
        });
        posted++;
      } else {
        failed++;
      }
    }

    return {
      success: true,
      message: `Sync completed: ${posted} posted, ${failed} failed, ${postedProposalIds.size} already existed`,
      posted,
      failed,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Unknown error during sync",
      posted: 0,
      failed: 0,
    };
  }
}
