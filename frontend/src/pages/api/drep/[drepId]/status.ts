import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { drepId } = req.query;
    const backendApiUrl = process.env.BACKEND_API_URL;

    if (!drepId || typeof drepId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Bad request",
        message: "DRep ID is required",
      });
    }

    const response = await fetch(
      `${backendApiUrl}/sentiment/drep/${encodeURIComponent(drepId)}/status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("DRep status error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to get DRep status",
    });
  }
}
