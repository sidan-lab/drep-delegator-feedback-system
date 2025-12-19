import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/sentiment/[proposalId]/reactions
 * Proxies to backend: GET /sentiment/{proposalId}/reactions?drepId={drepId}
 * Returns individual reactions for a proposal filtered by DRep
 * Requires JWT authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { proposalId, drepId, limit, offset } = req.query;

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
    // Build query string with optional pagination
    const params = new URLSearchParams();
    params.set("drepId", drepId);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));

    const backendApiUrl = process.env.BACKEND_API_URL;
    const response = await fetch(
      `${backendApiUrl}/sentiment/${encodeURIComponent(proposalId)}/reactions?${params.toString()}`,
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
    console.error("Sentiment reactions API error:", error);
    return res.status(500).json({ error: "Failed to fetch sentiment reactions" });
  }
}
