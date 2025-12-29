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

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authorization header required",
      });
    }

    const response = await fetch(`${backendApiUrl}/auth/reset-api-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Reset API key error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to reset API key",
    });
  }
}
