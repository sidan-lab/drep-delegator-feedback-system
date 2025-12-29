import { Router } from "express";
import { signIn, claimDrep, getMe, getApiKey, resetApiKey } from "../controllers/auth";
import { jwtAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * Auth Routes
 *
 * Public:
 * - POST /auth/signin - Sign in with wallet address (after frontend verifies signature)
 *
 * JWT-authenticated:
 * - POST /auth/claim-drep - Link authenticated user to a DRep registration
 * - GET /auth/me - Get current user profile and linked DRep info
 * - GET /auth/api-key - Get API key for linked and approved DRep
 * - POST /auth/reset-api-key - Reset API key (self-service for approved DReps)
 */

// Public routes
router.post("/signin", signIn);

// JWT-authenticated routes
router.post("/claim-drep", jwtAuth, claimDrep);
router.get("/me", jwtAuth, getMe);
router.get("/api-key", jwtAuth, getApiKey);
router.post("/reset-api-key", jwtAuth, resetApiKey);

export default router;
