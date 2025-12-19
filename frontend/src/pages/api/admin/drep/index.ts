import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
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

    // Pass through query parameters
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = queryString
      ? `${backendApiUrl}/admin/drep?${queryString}`
      : `${backendApiUrl}/admin/drep`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Admin list dreps error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to list DRep registrations",
    });
  }
}
