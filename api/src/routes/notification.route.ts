import express from "express";
import { notificationController } from "../controllers";
import { apiKeyAuth, jwtAuth } from "../middleware/auth.middleware";

const router = express.Router();

// ============================================
// DRep Notification Preferences (JWT Auth)
// ============================================

/**
 * @openapi
 * /notification/preferences:
 *   get:
 *     summary: Get notification preferences
 *     description: Get the authenticated DRep's notification preferences
 *     tags:
 *       - Notification Preferences
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 *       403:
 *         description: DRep registration required or not approved
 */
router.get("/preferences", jwtAuth, notificationController.getPreferences);

/**
 * @openapi
 * /notification/preferences:
 *   post:
 *     summary: Update notification preferences
 *     description: Create or update the authenticated DRep's notification preferences
 *     tags:
 *       - Notification Preferences
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discordChannelEnabled:
 *                 type: boolean
 *                 description: Enable forum thread reminders
 *               discordDmEnabled:
 *                 type: boolean
 *                 description: Enable direct message alerts
 *               webPushEnabled:
 *                 type: boolean
 *                 description: Enable browser push notifications
 *               alertDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Days before expiry to send alerts (e.g., [7, 3, 1])
 *               discordUserId:
 *                 type: string
 *                 description: Discord user ID for DM delivery
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: DRep registration required or not approved
 */
router.post("/preferences", jwtAuth, notificationController.updatePreferences);

/**
 * @openapi
 * /notification/preferences:
 *   delete:
 *     summary: Delete notification preferences
 *     description: Delete the authenticated DRep's notification preferences
 *     tags:
 *       - Notification Preferences
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences deleted successfully
 *       404:
 *         description: Preferences not found
 *       403:
 *         description: DRep registration required
 */
router.delete("/preferences", jwtAuth, notificationController.deletePreferences);

/**
 * @openapi
 * /notification/alerts/my-pending:
 *   get:
 *     summary: Get my pending deadline alerts
 *     description: Get pending IN_APP_TOAST alerts for the authenticated DRep (used by polling hook)
 *     tags:
 *       - Notification Preferences
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Pending alerts retrieved successfully
 *       403:
 *         description: DRep registration required
 */
router.get("/alerts/my-pending", jwtAuth, notificationController.getMyAlerts);

// ============================================
// Alert Management (API Key Auth - for Discord bot/cron)
// ============================================

/**
 * @openapi
 * /notification/pending-alerts:
 *   get:
 *     summary: Get pending deadline alerts
 *     description: Returns pending alerts for Discord bot to process
 *     tags:
 *       - Deadline Alerts
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: channel
 *         in: query
 *         required: false
 *         description: Filter by alert channel (DISCORD_CHANNEL, DISCORD_DM, WEB_PUSH)
 *         schema:
 *           type: string
 *       - name: drepId
 *         in: query
 *         required: false
 *         description: Filter by DRep ID
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Maximum number of alerts to return (max 500)
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Pending alerts retrieved
 */
router.get("/pending-alerts", apiKeyAuth, notificationController.getPendingAlerts);

/**
 * @openapi
 * /notification/mark-alert-sent:
 *   post:
 *     summary: Mark an alert as sent
 *     description: Called by Discord bot after sending notification
 *     tags:
 *       - Deadline Alerts
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alertId
 *               - status
 *             properties:
 *               alertId:
 *                 type: string
 *                 description: DeadlineAlert ID
 *               status:
 *                 type: string
 *                 enum: [SENT, FAILED]
 *                 description: Delivery status
 *               errorMessage:
 *                 type: string
 *                 description: Error message if status is FAILED
 *     responses:
 *       200:
 *         description: Alert marked successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Alert not found
 */
router.post("/mark-alert-sent", apiKeyAuth, notificationController.markAlertSent);

/**
 * @openapi
 * /notification/batch-mark-alerts:
 *   post:
 *     summary: Batch mark alerts as sent
 *     description: Called by Discord bot to mark multiple alerts at once
 *     tags:
 *       - Deadline Alerts
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alerts
 *             properties:
 *               alerts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - alertId
 *                     - status
 *                   properties:
 *                     alertId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [SENT, FAILED]
 *                     errorMessage:
 *                       type: string
 *     responses:
 *       200:
 *         description: Alerts marked successfully
 */
router.post("/batch-mark-alerts", apiKeyAuth, notificationController.batchMarkAlertsSent);

export default router;
