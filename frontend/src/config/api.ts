/**
 * API Configuration
 * Centralizes API endpoint configuration for the frontend
 *
 * All API calls are routed through Next.js API routes to keep
 * the backend API key secure on the server side.
 */

// API endpoints - these point to local Next.js API routes
// The actual backend URL and API key are configured via server-side
// environment variables (BACKEND_API_URL and BACKEND_API_KEY)
export const API_ENDPOINTS = {
  // Overview endpoints
  overview: "/api/overview",
  proposals: "/api/overview/proposals",
  ncl: "/api/overview/ncl",
  nclByYear: (year: number) => `/api/overview/ncl/${year}`,

  // Proposal detail endpoint (requires proposal_id parameter)
  proposalDetail: (proposalId: string) =>
    `/api/proposal/${encodeURIComponent(proposalId)}`,

  // Sentiment endpoints (requires proposalId and drepId)
  sentiment: (proposalId: string, drepId: string) =>
    `/api/sentiment/${encodeURIComponent(proposalId)}?drepId=${encodeURIComponent(drepId)}`,
  sentimentReactions: (proposalId: string, drepId: string) =>
    `/api/sentiment/${encodeURIComponent(proposalId)}/reactions?drepId=${encodeURIComponent(drepId)}`,
  sentimentComments: (proposalId: string, drepId: string) =>
    `/api/sentiment/${encodeURIComponent(proposalId)}/comments?drepId=${encodeURIComponent(drepId)}`,

  // Auth endpoints (JWT-based authentication)
  authSignIn: "/api/auth/signin",
  authMe: "/api/auth/me",
  authClaimDrep: "/api/auth/claim-drep",
  authApiKey: "/api/auth/api-key",
  authResetApiKey: "/api/auth/reset-api-key",

  // DRep registration endpoints
  drepRegister: "/api/drep/register",
  drepStatus: (drepId: string) => `/api/drep/${encodeURIComponent(drepId)}/status`,

  // Admin endpoints (JWT-authenticated with admin wallet check)
  adminCheck: "/api/admin/check",
  adminListDreps: "/api/admin/drep",
  adminApproveDrep: (drepId: string) => `/api/admin/drep/${encodeURIComponent(drepId)}/approve`,
  adminRejectDrep: (drepId: string) => `/api/admin/drep/${encodeURIComponent(drepId)}/reject`,
} as const;
