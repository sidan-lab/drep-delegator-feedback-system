import { Router } from "express";
import { adminJwtAuth } from "../middleware/auth.middleware";
import * as sentimentController from "../controllers/sentiment/drepRegistration";

const router = Router();

/**
 * Admin routes for DRep management via UI
 * These routes use JWT authentication and check wallet address against admin list
 * (Separate from API key based admin endpoints in sentiment.route.ts)
 */

/**
 * @route GET /admin/drep
 * @description List all DRep registrations (admin only)
 * @query {string} status - Optional filter by status (PENDING, APPROVED, REJECTED)
 * @query {string} limit - Optional limit (default 50, max 100)
 * @query {string} offset - Optional offset for pagination
 */
router.get("/drep", adminJwtAuth, sentimentController.listDrepRegistrations);

/**
 * @route POST /admin/drep/:drepId/approve
 * @description Approve a DRep registration (admin only)
 * @param {string} drepId - The DRep ID to approve
 * @body {string} approvedBy - Name of the reviewer approving
 */
router.post("/drep/:drepId/approve", adminJwtAuth, sentimentController.approveDrep);

/**
 * @route POST /admin/drep/:drepId/reject
 * @description Reject a DRep registration (admin only)
 * @param {string} drepId - The DRep ID to reject
 * @body {string} reason - Reason for rejection
 */
router.post("/drep/:drepId/reject", adminJwtAuth, sentimentController.rejectDrep);

/**
 * @route GET /admin/check
 * @description Check if current user has admin privileges
 * Returns 200 if admin, 403 if not
 */
router.get("/check", adminJwtAuth, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "You have admin privileges",
  });
});

export default router;
