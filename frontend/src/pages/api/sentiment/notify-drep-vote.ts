import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST /api/sentiment/notify-drep-vote
 * Proxies to backend: POST /sentiment/notify-drep-vote
 * Notifies the backend that a DRep has voted on-chain so Discord can be updated
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

  const { drepId, proposalId, vote, txHash, rationaleUrl } = req.body;

  if (!proposalId || !vote || !txHash) {
    return res.status(400).json({
      error: "Missing required fields",
      message: "proposalId, vote, and txHash are required",
    });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const response = await fetch(`${backendApiUrl}/sentiment/notify-drep-vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        drepId,
        proposalId,
        vote,
        txHash,
        rationaleUrl,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Notify DRep vote API error:", error);
    return res.status(500).json({ error: "Failed to notify DRep vote" });
  }
}
