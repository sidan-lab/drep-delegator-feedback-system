/**
 * Server-side API Helper
 * Handles all API calls to the backend with API key authentication
 * This runs on the server side only, keeping the API key secure
 */

import { NextApiRequest, NextApiResponse } from "next";

interface CallApiArgs {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  isJson?: boolean;
  /** Pass the Next.js request to forward client IP for rate limiting */
  req?: NextApiRequest;
}

/**
 * Get the client's real IP from the Next.js request
 * Checks X-Forwarded-For header first (set by reverse proxies), then falls back to socket address
 */
function getClientIp(req?: NextApiRequest): string | undefined {
  if (!req) return undefined;

  // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
  // The first one is the original client IP
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(",")[0].trim();
  }

  // Fall back to direct connection IP
  return req.socket?.remoteAddress;
}

/**
 * Make a server-side API call to the backend
 * The API key is kept server-side and never exposed to the browser
 * Client IP is forwarded for proper rate limiting
 */
export async function callApi(args: CallApiArgs) {
  const backendApiUrl = process.env.BACKEND_API_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;
  const clientIp = getClientIp(args.req);

  const res = await fetch(backendApiUrl + args.endpoint, {
    method: args.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(backendApiKey && { "X-API-Key": backendApiKey }),
      // Forward the original client IP for rate limiting
      ...(clientIp && { "X-Forwarded-For": clientIp }),
      ...args.headers,
    },
    body: args.body,
    cache: "no-cache",
  });

  if (args.isJson !== false) {
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } else {
    const text = await res.text();
    return new Response(text, { status: res.status });
  }
}

/**
 * Helper to handle API errors consistently
 */
export function handleApiError(res: NextApiResponse, error: unknown) {
  console.error("API Error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ error: message });
}
