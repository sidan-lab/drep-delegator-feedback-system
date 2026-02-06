import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST /api/sentiment/draft-vote
 * Proxies to backend: POST /sentiment/draft-vote
 * Publishes or updates a draft vote intent
 * Requires JWT authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  const { proposalId, vote, rationaleUrl } = req.body;

  if (!proposalId || !vote) {
    return res.status(400).json({
      error: "Missing required fields",
      message: "proposalId and vote are required",
    });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const response = await fetch(`${backendApiUrl}/sentiment/draft-vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        proposalId,
        vote,
        rationaleUrl,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Publish draft vote API error:", error);
    return res.status(500).json({ error: "Failed to publish draft vote" });
  }
}
