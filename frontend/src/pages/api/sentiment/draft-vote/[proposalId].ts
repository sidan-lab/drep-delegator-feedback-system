import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/sentiment/draft-vote/[proposalId]
 * Proxies to backend: GET /sentiment/draft-vote/:proposalId
 * Gets a single draft vote for a proposal
 * Requires JWT authentication
 *
 * DELETE /api/sentiment/draft-vote/[proposalId]
 * Proxies to backend: DELETE /sentiment/draft-vote/:proposalId
 * Deletes a draft vote intent
 * Requires JWT authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { proposalId } = req.query;

  if (!proposalId || typeof proposalId !== "string") {
    return res.status(400).json({
      error: "Missing or invalid proposalId",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const url = `${backendApiUrl}/sentiment/draft-vote/${encodeURIComponent(proposalId)}`;

    if (req.method === "GET") {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else if (req.method === "DELETE") {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Draft vote API error:", error);
    return res.status(500).json({ error: "Failed to process draft vote request" });
  }
}
