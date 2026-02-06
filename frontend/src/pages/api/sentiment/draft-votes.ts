import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/sentiment/draft-votes
 * Proxies to backend: GET /sentiment/draft-votes
 * Gets all draft votes for the authenticated DRep
 * Requires JWT authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const response = await fetch(`${backendApiUrl}/sentiment/draft-votes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get draft votes API error:", error);
    return res.status(500).json({ error: "Failed to fetch draft votes" });
  }
}
