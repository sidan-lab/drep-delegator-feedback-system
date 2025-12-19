import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/sentiment/[proposalId]
 * Proxies to backend: GET /sentiment/{proposalId}?drepId={drepId}
 * Returns aggregated sentiment summary for a proposal filtered by DRep
 * Requires JWT authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { proposalId, drepId } = req.query;

  if (!proposalId || typeof proposalId !== "string") {
    return res.status(400).json({ error: "Proposal ID is required" });
  }

  if (!drepId || typeof drepId !== "string") {
    return res.status(400).json({ error: "DRep ID is required" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const response = await fetch(
      `${backendApiUrl}/sentiment/${encodeURIComponent(proposalId)}?drepId=${encodeURIComponent(drepId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Sentiment API error:", error);
    return res.status(500).json({ error: "Failed to fetch sentiment data" });
  }
}
