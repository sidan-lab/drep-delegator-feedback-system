import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST /api/verifyDelegator
 * Proxies the delegator verification request to the backend API
 * Keeps the API key secure on the server side
 */

interface VerifyDelegatorBody {
  drepId: string;
  discordUserId: string;
  discordUsername?: string;
  stakeAddress: string;
}

interface SuccessResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    drepId: string;
    discordUserId: string;
    stakeAddress: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
}

type ResponseData = SuccessResponse | ErrorResponse;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      message: "Only POST requests are allowed",
    });
  }

  const backendApiUrl = process.env.BACKEND_API_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured");
    return res.status(500).json({
      success: false,
      error: "Server configuration error",
      message: "Backend API URL is not configured",
    });
  }

  const { drepId, discordUserId, discordUsername, stakeAddress }: VerifyDelegatorBody = req.body;

  // Validate required fields
  if (!drepId || !discordUserId || !stakeAddress) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
      message: "drepId, discordUserId, and stakeAddress are required",
    });
  }

  try {
    const response = await fetch(`${backendApiUrl}/sentiment/delegator/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(backendApiKey && { "X-API-Key": backendApiKey }),
      },
      body: JSON.stringify({
        drepId,
        discordUserId,
        discordUsername: discordUsername || "",
        stakeAddress,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || "Verification failed",
        message: data.message || "Failed to verify delegator",
      });
    }

    return res.status(200).json({
      success: true,
      message: data.message || "Delegator verified successfully",
      data: data.data,
    });
  } catch (error) {
    console.error("Error verifying delegator:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Failed to connect to backend API",
    });
  }
}
