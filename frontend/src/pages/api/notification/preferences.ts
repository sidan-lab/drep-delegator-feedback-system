import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const allowedMethods = ["GET", "POST", "DELETE"];
  if (!allowedMethods.includes(req.method || "")) {
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

    const response = await fetch(`${backendApiUrl}/notification/preferences`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      ...(req.method !== "GET" && { body: JSON.stringify(req.body) }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Notification preferences error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to process notification preferences",
    });
  }
}
