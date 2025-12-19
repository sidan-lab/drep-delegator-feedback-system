import { Request, Response, NextFunction } from "express";
import { prisma } from "../services";
import { verifyJWT } from "../libs/jwt";

// Extend Express Request to include drepId and user
declare global {
  namespace Express {
    interface Request {
      drepId?: string;
      drepRegistration?: {
        id: string;
        drepId: string;
        drepName: string | null;
        discordGuildId: string | null;
        status: string;
      };
      user?: {
        id: string;
        walletAddress: string | null;
        drepRegistration?: {
          id: string;
          drepId: string;
          drepName: string | null;
          status: string;
        } | null;
      };
    }
  }
}

/**
 * Admin API Key Authentication Middleware
 * Validates against SERVER_API_KEY env var for admin operations
 */
export function adminApiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const serverApiKey = process.env.SERVER_API_KEY;

  // If no server API key is configured, reject all admin requests
  if (!serverApiKey) {
    console.warn(
      "⚠️  SERVER_API_KEY not configured. Admin endpoints are disabled."
    );
    return res.status(503).json({
      error: "Service unavailable",
      message: "Admin authentication is not configured.",
    });
  }

  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "API key is required. Please provide X-API-Key header.",
    });
  }

  // Validate API key
  if (apiKey !== serverApiKey) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid admin API key.",
    });
  }

  next();
}

/**
 * Per-DRep API Key Authentication Middleware
 * Validates the API key from the request header against registered DRep API keys in database
 * Attaches drepId and drepRegistration to request for downstream use
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "API key is required. Please provide X-API-Key header.",
    });
  }

  try {
    // Look up the API key in the database
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { apiKey },
      select: {
        id: true,
        drepId: true,
        drepName: true,
        discordGuildId: true,
        status: true,
      },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Invalid API key.",
      });
    }

    // Check if DRep is approved
    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        error: "Forbidden",
        message: "DRep registration is not approved.",
      });
    }

    // Attach DRep info to request for downstream use
    req.drepId = drepRegistration.drepId;
    req.drepRegistration = drepRegistration;

    next();
  } catch (error) {
    console.error("Error validating API key:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate API key.",
    });
  }
}

/**
 * Optional API Key Authentication Middleware
 * Same as apiKeyAuth but allows requests without API key (for public endpoints)
 * If API key is provided, validates it and attaches DRep info
 */
export async function optionalApiKeyAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // If no API key provided, continue without authentication
  if (!apiKey) {
    return next();
  }

  try {
    // Look up the API key in the database
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { apiKey },
      select: {
        id: true,
        drepId: true,
        drepName: true,
        discordGuildId: true,
        status: true,
      },
    });

    if (drepRegistration && drepRegistration.status === "APPROVED") {
      // Attach DRep info to request for downstream use
      req.drepId = drepRegistration.drepId;
      req.drepRegistration = drepRegistration;
    }

    next();
  } catch (error) {
    console.error("Error validating API key:", error);
    // Continue without auth on error for optional auth
    next();
  }
}

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header (Bearer token)
 * Attaches user info to request for downstream use
 */
export async function jwtAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Check if Authorization header is provided
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Authorization header with Bearer token is required.",
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify the JWT
  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid or expired token.",
    });
  }

  try {
    // Look up the user in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        walletAddress: true,
        jwt: true,
        drepRegistration: {
          select: {
            id: true,
            drepId: true,
            drepName: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not found.",
      });
    }

    // Optionally verify the token matches the stored JWT (for session invalidation)
    if (user.jwt !== token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Token has been invalidated. Please sign in again.",
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      walletAddress: user.walletAddress,
      drepRegistration: user.drepRegistration,
    };

    next();
  } catch (error) {
    console.error("Error validating JWT:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to validate token.",
    });
  }
}

/**
 * Admin JWT Authentication Middleware
 * Validates JWT token and checks if wallet address is in admin list
 * Used for admin UI access (as opposed to API key based admin access)
 */
export async function adminJwtAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Check if Authorization header is provided
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Authorization header with Bearer token is required.",
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify the JWT
  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid or expired token.",
    });
  }

  // Get admin wallet addresses from env
  const adminWallets = process.env.ADMIN_WALLET_ADDRESSES?.split(",").map((a) =>
    a.trim().toLowerCase()
  );

  if (!adminWallets || adminWallets.length === 0) {
    console.warn(
      "⚠️  ADMIN_WALLET_ADDRESSES not configured. Admin UI endpoints are disabled."
    );
    return res.status(503).json({
      success: false,
      error: "Service unavailable",
      message: "Admin authentication is not configured.",
    });
  }

  try {
    // Look up the user in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        walletAddress: true,
        jwt: true,
        drepRegistration: {
          select: {
            id: true,
            drepId: true,
            drepName: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not found.",
      });
    }

    // Verify the token matches the stored JWT
    if (user.jwt !== token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Token has been invalidated. Please sign in again.",
      });
    }

    // Check if wallet address is in admin list
    const userWallet = user.walletAddress?.toLowerCase();
    if (!userWallet || !adminWallets.includes(userWallet)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You do not have admin privileges.",
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      walletAddress: user.walletAddress,
      drepRegistration: user.drepRegistration,
    };

    next();
  } catch (error) {
    console.error("Error validating admin JWT:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to validate token.",
    });
  }
}

/**
 * Optional JWT Authentication Middleware
 * Same as jwtAuth but allows requests without token
 * If token is provided, validates it and attaches user info
 */
export async function optionalJwtAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // If no Authorization header, continue without authentication
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);

  // If token is invalid, continue without auth (it's optional)
  if (!payload) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        walletAddress: true,
        jwt: true,
        drepRegistration: {
          select: {
            id: true,
            drepId: true,
            drepName: true,
            status: true,
          },
        },
      },
    });

    if (user && user.jwt === token) {
      req.user = {
        id: user.id,
        walletAddress: user.walletAddress,
        drepRegistration: user.drepRegistration,
      };
    }

    next();
  } catch (error) {
    console.error("Error validating JWT:", error);
    // Continue without auth on error for optional auth
    next();
  }
}

/**
 * Validate that the guild ID in the request matches the DRep's registered Discord guild ID
 * Call this after apiKeyAuth middleware has attached drepRegistration to the request
 * @param req - Express request with drepRegistration attached
 * @param guildId - Guild ID from the request body or query
 * @returns Object with valid boolean and error message if invalid
 */
export function validateGuildId(
  req: Request,
  guildId: string
): { valid: boolean; error?: string } {
  const registeredGuildId = req.drepRegistration?.discordGuildId;

  // If no guild ID is registered for this DRep, allow any guild (backwards compatibility)
  if (!registeredGuildId) {
    console.warn(
      `[GuildValidation] DRep ${req.drepId} has no registered guild ID, allowing request from guild ${guildId}`
    );
    return { valid: true };
  }

  // Validate the guild ID matches
  if (guildId !== registeredGuildId) {
    console.warn(
      `[GuildValidation] Guild ID mismatch for DRep ${req.drepId}: request guild ${guildId}, registered guild ${registeredGuildId}`
    );
    return {
      valid: false,
      error: `Unauthorized Discord server. This API key is only authorized for guild ${registeredGuildId}.`,
    };
  }

  return { valid: true };
}
