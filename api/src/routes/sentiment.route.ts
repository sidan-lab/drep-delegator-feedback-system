import express from "express";
import { sentimentController } from "../controllers";
import { apiKeyAuth, adminApiKeyAuth, jwtAuth } from "../middleware/auth.middleware";

const router = express.Router();

// ============================================
// DRep Registration Endpoints
// ============================================

/**
 * @openapi
 * /sentiment/drep/register:
 *   post:
 *     summary: Register a new DRep for sentiment collection
 *     description: |
 *       Submit registration for admin approval. Requires JWT authentication and verifies DRep ownership.
 *       The connected wallet must be the same wallet that registered the DRep on-chain.
 *     tags:
 *       - DRep Registration
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - drepId
 *               - discordGuildId
 *             properties:
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               discordGuildId:
 *                 type: string
 *                 description: Authorized Discord server ID (snowflake format)
 *               drepName:
 *                 type: string
 *                 description: Display name
 *               contactEmail:
 *                 type: string
 *                 description: Contact email for communication
 *     responses:
 *       201:
 *         description: Registration submitted successfully (ownership verified)
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Authentication required
 *       403:
 *         description: DRep ownership verification failed
 *       409:
 *         description: DRep already registered or user already has registration
 */
router.post("/drep/register", jwtAuth, sentimentController.registerDrep); // Requires JWT + DRep ownership verification

/**
 * @openapi
 * /sentiment/drep/{drepId}/status:
 *   get:
 *     summary: Get DRep registration status
 *     description: Check registration status (public endpoint)
 *     tags:
 *       - DRep Registration
 *     parameters:
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registration status retrieved
 *       404:
 *         description: DRep not found
 */
router.get("/drep/:drepId/status", sentimentController.getDrepStatus); // Public

/**
 * @openapi
 * /sentiment/drep/{drepId}/approve:
 *   post:
 *     summary: Approve a DRep registration (Admin)
 *     description: Approve registration and generate API key. Requires SERVER_API_KEY.
 *     tags:
 *       - DRep Registration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvedBy:
 *                 type: string
 *                 description: Admin identifier
 *     responses:
 *       200:
 *         description: DRep approved, API key generated
 *       400:
 *         description: Already approved
 *       404:
 *         description: DRep not found
 */
router.post("/drep/:drepId/approve", adminApiKeyAuth, sentimentController.approveDrep); // Admin only

/**
 * @openapi
 * /sentiment/drep/{drepId}/reject:
 *   post:
 *     summary: Reject a DRep registration (Admin)
 *     description: Reject registration with reason. Requires SERVER_API_KEY.
 *     tags:
 *       - DRep Registration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Rejection reason
 *               rejectedBy:
 *                 type: string
 *                 description: Admin identifier
 *     responses:
 *       200:
 *         description: DRep rejected
 *       404:
 *         description: DRep not found
 */
router.post("/drep/:drepId/reject", adminApiKeyAuth, sentimentController.rejectDrep); // Admin only

/**
 * @openapi
 * /sentiment/drep/{drepId}/regenerate-key:
 *   post:
 *     summary: Regenerate API key for a DRep (Admin)
 *     description: Generate new API key if compromised. Requires SERVER_API_KEY.
 *     tags:
 *       - DRep Registration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: New API key generated
 *       400:
 *         description: DRep not approved
 *       404:
 *         description: DRep not found
 */
router.post("/drep/:drepId/regenerate-key", adminApiKeyAuth, sentimentController.regenerateApiKey); // Admin only

/**
 * @openapi
 * /sentiment/drep:
 *   get:
 *     summary: List all DRep registrations (Admin)
 *     description: Get paginated list of all registrations. Requires SERVER_API_KEY.
 *     tags:
 *       - DRep Registration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         description: Filter by status (PENDING, APPROVED, REJECTED)
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Registrations retrieved
 */
router.get("/drep", adminApiKeyAuth, sentimentController.listDrepRegistrations); // Admin only

/**
 * @openapi
 * /sentiment/register-guild:
 *   post:
 *     summary: Register a Discord guild for sentiment collection
 *     description: Called by Discord bots to register a server for sentiment collection
 *     tags:
 *       - Sentiment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guildId
 *               - guildName
 *               - drepId
 *             properties:
 *               guildId:
 *                 type: string
 *                 description: Discord server ID
 *               guildName:
 *                 type: string
 *                 description: Discord server name
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               governanceChannelId:
 *                 type: string
 *                 description: Optional specific channel for governance discussions
 *     responses:
 *       200:
 *         description: Guild registered successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: DRep not authorized
 */
router.post("/register-guild", apiKeyAuth, sentimentController.registerGuild); // Per-DRep auth

/**
 * @openapi
 * /sentiment/reaction:
 *   post:
 *     summary: Submit or remove a reaction from Discord
 *     description: Called by Discord bots when users react to proposal messages
 *     tags:
 *       - Sentiment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - proposalId
 *               - drepId
 *               - guildId
 *               - channelId
 *               - discordUserId
 *               - sentiment
 *               - action
 *             properties:
 *               proposalId:
 *                 type: string
 *                 description: Cardano governance action ID
 *               drepId:
 *                 type: string
 *                 description: DRep ID receiving feedback
 *               guildId:
 *                 type: string
 *                 description: Discord server ID
 *               guildName:
 *                 type: string
 *                 description: Discord server name
 *               channelId:
 *                 type: string
 *                 description: Discord channel ID
 *               channelName:
 *                 type: string
 *                 description: Discord channel name
 *               discordUserId:
 *                 type: string
 *                 description: Discord user ID
 *               discordUsername:
 *                 type: string
 *                 description: Discord username
 *               sentiment:
 *                 type: string
 *                 enum: [yes, no, abstain]
 *                 description: Sentiment type
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Whether to add or remove the reaction
 *     responses:
 *       200:
 *         description: Reaction recorded successfully
 *       400:
 *         description: Missing required fields or invalid values
 *       403:
 *         description: DRep not authorized
 */
router.post("/reaction", apiKeyAuth, sentimentController.submitReaction); // Per-DRep auth

/**
 * @openapi
 * /sentiment/comment:
 *   post:
 *     summary: Submit a comment from Discord
 *     description: Called by Discord bots when users comment on proposal discussions
 *     tags:
 *       - Sentiment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - proposalId
 *               - drepId
 *               - guildId
 *               - channelId
 *               - discordUserId
 *               - messageId
 *               - content
 *             properties:
 *               proposalId:
 *                 type: string
 *                 description: Cardano governance action ID
 *               drepId:
 *                 type: string
 *                 description: DRep ID receiving feedback
 *               guildId:
 *                 type: string
 *                 description: Discord server ID
 *               guildName:
 *                 type: string
 *                 description: Discord server name
 *               channelId:
 *                 type: string
 *                 description: Discord channel ID
 *               channelName:
 *                 type: string
 *                 description: Discord channel name
 *               discordUserId:
 *                 type: string
 *                 description: Discord user ID
 *               discordUsername:
 *                 type: string
 *                 description: Discord username
 *               messageId:
 *                 type: string
 *                 description: Discord message ID
 *               content:
 *                 type: string
 *                 description: Comment content
 *               sentiment:
 *                 type: string
 *                 enum: [yes, no, abstain]
 *                 description: Optional detected sentiment
 *     responses:
 *       200:
 *         description: Comment recorded successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: DRep not authorized
 *       409:
 *         description: Duplicate comment (messageId already exists)
 */
router.post("/comment", apiKeyAuth, sentimentController.submitComment); // Per-DRep auth

/**
 * @openapi
 * /sentiment/{proposal_id}:
 *   get:
 *     summary: Get sentiment summary for a proposal
 *     description: Returns aggregated sentiment data for a governance proposal
 *     tags:
 *       - Sentiment
 *     parameters:
 *       - name: proposal_id
 *         in: path
 *         required: true
 *         description: Cardano governance action ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: false
 *         description: Filter by specific DRep ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sentiment data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proposalId:
 *                   type: string
 *                 sentiment:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       drepId:
 *                         type: string
 *                       yesCount:
 *                         type: integer
 *                       noCount:
 *                         type: integer
 *                       abstainCount:
 *                         type: integer
 *                       commentCount:
 *                         type: integer
 *                 totals:
 *                   type: object
 *                   properties:
 *                     yesCount:
 *                       type: integer
 *                     noCount:
 *                       type: integer
 *                     abstainCount:
 *                       type: integer
 *                     commentCount:
 *                       type: integer
 *                     totalReactions:
 *                       type: integer
 */
// Route moved to end of file to avoid matching before specific routes

/**
 * @openapi
 * /sentiment/{proposal_id}/comments:
 *   get:
 *     summary: Get comments for a proposal
 *     description: Returns paginated comments for a governance proposal
 *     tags:
 *       - Sentiment
 *     parameters:
 *       - name: proposal_id
 *         in: path
 *         required: true
 *         description: Cardano governance action ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: false
 *         description: Filter by specific DRep ID
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of comments to return (max 100)
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Number of comments to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 */
// Route moved to end of file to avoid matching before specific routes

/**
 * @openapi
 * /sentiment/{proposal_id}/reactions:
 *   get:
 *     summary: Get individual reactions for a proposal
 *     description: Returns paginated individual reactions for detailed breakdown
 *     tags:
 *       - Sentiment
 *     parameters:
 *       - name: proposal_id
 *         in: path
 *         required: true
 *         description: Cardano governance action ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: false
 *         description: Filter by specific DRep ID
 *         schema:
 *           type: string
 *       - name: sentiment
 *         in: query
 *         required: false
 *         description: Filter by sentiment type
 *         schema:
 *           type: string
 *           enum: [yes, no, abstain]
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of reactions to return (max 500)
 *         schema:
 *           type: integer
 *           default: 100
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Number of reactions to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Reactions retrieved successfully
 */
// Route moved to end of file to avoid matching before specific routes

// ============================================
// Delegator Verification Endpoints
// ============================================

/**
 * @openapi
 * /sentiment/delegator/verify:
 *   post:
 *     summary: Verify a delegator and link Discord account
 *     description: Called from delegator verification frontend to link wallet to Discord
 *     tags:
 *       - Delegators
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - drepId
 *               - discordUserId
 *               - stakeAddress
 *             properties:
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               discordUserId:
 *                 type: string
 *                 description: Discord user ID
 *               discordUsername:
 *                 type: string
 *                 description: Discord username
 *               stakeAddress:
 *                 type: string
 *                 description: Cardano stake address (stake1...)
 *               liveStake:
 *                 type: string
 *                 description: Current stake amount in lovelace
 *     responses:
 *       200:
 *         description: Delegator verified successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: DRep not registered or not approved
 *       409:
 *         description: Stake address already linked to another Discord account
 */
router.post("/delegator/verify", apiKeyAuth, sentimentController.verifyDelegator); // Per-DRep auth

/**
 * @openapi
 * /sentiment/delegator/check:
 *   get:
 *     summary: Check if a Discord user is a verified delegator
 *     description: Used by Discord bot to confirm verification status before granting role
 *     tags:
 *       - Delegators
 *     parameters:
 *       - name: drepId
 *         in: query
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *       - name: discordUserId
 *         in: query
 *         required: true
 *         description: Discord user ID to check
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 verified:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 delegator:
 *                   type: object
 *                   properties:
 *                     discordUserId:
 *                       type: string
 *                     discordUsername:
 *                       type: string
 *                     stakeAddress:
 *                       type: string
 *                     liveStake:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       400:
 *         description: Missing required parameters
 */
router.get("/delegator/check", apiKeyAuth, sentimentController.checkDelegator); // Per-DRep auth

/**
 * @openapi
 * /sentiment/delegator/deactivate:
 *   post:
 *     summary: Deactivate a delegator
 *     description: Called by DRep to deactivate a delegator who changed delegation
 *     tags:
 *       - Delegators
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - drepId
 *               - discordUserId
 *             properties:
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               discordUserId:
 *                 type: string
 *                 description: Discord user ID to deactivate
 *               reason:
 *                 type: string
 *                 description: Reason for deactivation
 *     responses:
 *       200:
 *         description: Delegator deactivated successfully
 *       404:
 *         description: Delegator not found
 */
router.post("/delegator/deactivate", apiKeyAuth, sentimentController.deactivateDelegator); // Per-DRep auth

/**
 * @openapi
 * /sentiment/delegator/{drepId}:
 *   get:
 *     summary: List verified delegators for a DRep
 *     description: Returns paginated list of verified delegators
 *     tags:
 *       - Delegators
 *     parameters:
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *       - name: active
 *         in: query
 *         required: false
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of delegators to return (max 500)
 *         schema:
 *           type: integer
 *           default: 100
 *       - name: offset
 *         in: query
 *         required: false
 *         description: Number of delegators to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Delegators retrieved successfully
 */
router.get("/delegator/:drepId", apiKeyAuth, sentimentController.listDelegators); // Per-DRep auth

// ============================================
// Proposal Post Tracking Endpoints
// ============================================

/**
 * @openapi
 * /sentiment/proposal-post:
 *   post:
 *     summary: Record a proposal posted to a Discord guild
 *     description: Called by Discord bot after creating a forum thread for a proposal
 *     tags:
 *       - Proposal Posts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guildId
 *               - drepId
 *               - proposalId
 *               - threadId
 *             properties:
 *               guildId:
 *                 type: string
 *                 description: Discord server ID
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               proposalId:
 *                 type: string
 *                 description: Cardano governance action ID
 *               threadId:
 *                 type: string
 *                 description: Discord forum thread ID
 *     responses:
 *       201:
 *         description: Proposal post recorded successfully
 *       400:
 *         description: Missing required fields or proposal not found
 *       403:
 *         description: DRep or guild not authorized
 */
router.post("/proposal-post", apiKeyAuth, sentimentController.createProposalPost); // Per-DRep auth

/**
 * @openapi
 * /sentiment/proposal-post/check:
 *   get:
 *     summary: Check if a proposal has been posted to a guild
 *     description: Used by Discord bot to check before posting to avoid duplicates
 *     tags:
 *       - Proposal Posts
 *     parameters:
 *       - name: guildId
 *         in: query
 *         required: true
 *         description: Discord server ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *       - name: proposalId
 *         in: query
 *         required: true
 *         description: Cardano governance action ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 posted:
 *                   type: boolean
 *                 post:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     threadId:
 *                       type: string
 *                     postedAt:
 *                       type: string
 */
router.get("/proposal-post/check", apiKeyAuth, sentimentController.checkProposalPost); // Per-DRep auth

/**
 * @openapi
 * /sentiment/proposal-post/by-thread:
 *   get:
 *     summary: Get proposal ID by thread ID
 *     description: Used by Discord bot to look up proposalId for comment collection
 *     tags:
 *       - Proposal Posts
 *     parameters:
 *       - name: threadId
 *         in: query
 *         required: true
 *         description: Discord forum thread ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proposal ID retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 proposalId:
 *                   type: string
 *                 guildId:
 *                   type: string
 *       404:
 *         description: Thread not found
 */
router.get("/proposal-post/by-thread", apiKeyAuth, sentimentController.getProposalByThreadId); // Per-DRep auth

/**
 * @openapi
 * /sentiment/proposal-post/{guildId}/{drepId}:
 *   get:
 *     summary: Get all proposal posts for a guild
 *     description: Returns list of all proposals posted to a specific guild
 *     tags:
 *       - Proposal Posts
 *     parameters:
 *       - name: guildId
 *         in: path
 *         required: true
 *         description: Discord server ID
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: path
 *         required: true
 *         description: DRep ID (CIP-129 format)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proposal posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 guildId:
 *                   type: string
 *                 drepId:
 *                   type: string
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       proposalId:
 *                         type: string
 *                       threadId:
 *                         type: string
 *                       postedAt:
 *                         type: string
 *                 count:
 *                   type: integer
 */
router.get("/proposal-post/:guildId/:drepId", apiKeyAuth, sentimentController.getProposalPosts); // Per-DRep auth

/**
 * @openapi
 * /sentiment/proposal-post:
 *   delete:
 *     summary: Delete a proposal post record
 *     description: Used if a forum thread is deleted manually
 *     tags:
 *       - Proposal Posts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guildId
 *               - drepId
 *               - proposalId
 *             properties:
 *               guildId:
 *                 type: string
 *                 description: Discord server ID
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-129 format)
 *               proposalId:
 *                 type: string
 *                 description: Cardano governance action ID
 *     responses:
 *       200:
 *         description: Proposal post deleted successfully
 *       404:
 *         description: Proposal post not found
 */
router.delete("/proposal-post", apiKeyAuth, sentimentController.deleteProposalPost); // Per-DRep auth

// ============================================
// DRep Vote Notification Endpoints
// ============================================

/**
 * @openapi
 * /sentiment/notify-drep-vote:
 *   post:
 *     summary: Notify that a DRep has voted on-chain
 *     description: Called from frontend after DRep submits a vote to update Discord forum post
 *     tags:
 *       - DRep Vote Notification
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - drepId
 *               - proposalId
 *               - vote
 *               - txHash
 *             properties:
 *               drepId:
 *                 type: string
 *                 description: DRep ID (CIP-105 or CIP-129 format)
 *               proposalId:
 *                 type: string
 *                 description: Cardano governance action ID
 *               vote:
 *                 type: string
 *                 enum: [Yes, No, Abstain]
 *                 description: Vote choice
 *               txHash:
 *                 type: string
 *                 description: Transaction hash of the vote
 *               rationaleUrl:
 *                 type: string
 *                 description: Optional rationale anchor URL
 *     responses:
 *       200:
 *         description: Notification recorded successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: DRep not registered or not approved
 */
router.post("/notify-drep-vote", jwtAuth, sentimentController.notifyDrepVote); // JWT auth for frontend DRep voting

/**
 * @openapi
 * /sentiment/pending-drep-vote-notifications:
 *   get:
 *     summary: Get pending DRep vote notifications for Discord bot
 *     description: Returns GuildProposalPosts where drepVote is set but Discord hasn't been notified
 *     tags:
 *       - DRep Vote Notification
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: drepId
 *         in: query
 *         required: false
 *         description: Filter by DRep ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending notifications retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       guildId:
 *                         type: string
 *                       drepId:
 *                         type: string
 *                       proposalId:
 *                         type: string
 *                       threadId:
 *                         type: string
 *                       drepVote:
 *                         type: string
 *                       drepRationaleUrl:
 *                         type: string
 *                       drepVoteTxHash:
 *                         type: string
 *                       drepVotedAt:
 *                         type: string
 *                 count:
 *                   type: integer
 */
router.get("/pending-drep-vote-notifications", apiKeyAuth, sentimentController.getPendingDrepVoteNotifications);

/**
 * @openapi
 * /sentiment/mark-drep-vote-notified:
 *   post:
 *     summary: Mark a DRep vote notification as sent to Discord
 *     description: Called by Discord bot after successfully updating the forum thread
 *     tags:
 *       - DRep Vote Notification
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 *                 description: GuildProposalPost ID
 *     responses:
 *       200:
 *         description: Notification marked as sent
 *       400:
 *         description: Missing postId
 *       404:
 *         description: Post not found
 */
router.post("/mark-drep-vote-notified", apiKeyAuth, sentimentController.markDrepVoteNotified);

// ============================================
// Dynamic Proposal Routes (MUST BE LAST)
// These routes use /:proposal_id which matches ANY path.
// They must come after all specific routes to avoid incorrect matching.
// ============================================
router.get("/:proposal_id", jwtAuth, sentimentController.getSentiment); // JWT auth for frontend DRep viewing
router.get("/:proposal_id/comments", jwtAuth, sentimentController.getComments); // JWT auth for frontend DRep viewing
router.get("/:proposal_id/reactions", jwtAuth, sentimentController.getReactions); // JWT auth for frontend DRep viewing

export default router;