/**
 * API Configuration
 * Centralizes API endpoint configuration for the frontend
 */

// API base URL - defaults to localhost:3001 for development
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// API key for authentication
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// API endpoints
export const API_ENDPOINTS = {
  // Overview endpoints
  overview: `${API_BASE_URL}/overview`,
  proposals: `${API_BASE_URL}/overview/proposals`,

  // Proposal detail endpoint (requires proposal_id parameter)
  proposalDetail: (proposalId: string) =>
    `${API_BASE_URL}/proposal/${encodeURIComponent(proposalId)}`,
} as const;
