import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const backendApiUrl = process.env.BACKEND_API_URL;
    const authHeader = req.headers.authorization;
    const { drepId } = req.query;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authorization header required",
      });
    }

    if (!drepId || typeof drepId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Bad request",
        message: "drepId is required",
      });
    }

    const response = await fetch(
      `${backendApiUrl}/admin/drep/${encodeURIComponent(drepId)}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Admin reject drep error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to reject DRep",
    });
  }
}
