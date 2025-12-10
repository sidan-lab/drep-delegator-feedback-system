import express from "express";
import { sentimentController } from "../controllers";

const router = express.Router();

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
router.post("/register-guild", sentimentController.registerGuild);

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
router.post("/reaction", sentimentController.submitReaction);

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
router.post("/comment", sentimentController.submitComment);

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
router.get("/:proposal_id", sentimentController.getSentiment);

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
router.get("/:proposal_id/comments", sentimentController.getComments);

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
router.get("/:proposal_id/reactions", sentimentController.getReactions);

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
router.post("/delegator/verify", sentimentController.verifyDelegator);

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
router.post("/delegator/deactivate", sentimentController.deactivateDelegator);

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
router.get("/delegator/:drepId", sentimentController.listDelegators);

export default router;