/**
 * API Service
 * Handles all API calls to the backend for governance data
 *
 * All calls go through Next.js API routes which handle authentication
 * server-side, keeping the API key secure.
 */

import { API_ENDPOINTS } from "@/config/api";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  OverviewSummary,
  VoteRecord,
  NCLYearData,
  NCLDisplayData,
  SentimentResponse,
  SentimentReactionsResponse,
} from "@/types/governance";

/**
 * Generic fetch wrapper with error handling
 * API key authentication is handled server-side via Next.js API routes
 */
async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API Error (${response.status}): ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch overview summary statistics
 * Returns: proposal counts by status
 */
export async function fetchOverviewSummary(): Promise<OverviewSummary> {
  return fetchApi<OverviewSummary>(API_ENDPOINTS.overview);
}

/**
 * Convert lovelace string to ADA number
 * 1 ADA = 1,000,000 lovelace
 */
function lovelaceToAda(lovelace: string): number {
  return Number(lovelace) / 1_000_000;
}

/**
 * Transform NCL API response to display format (lovelace to ADA)
 */
function transformNCLData(data: NCLYearData): NCLDisplayData {
  const currentAda = lovelaceToAda(data.currentValue);
  const targetAda = lovelaceToAda(data.targetValue);
  const percentUsed = targetAda > 0 ? (currentAda / targetAda) * 100 : 0;

  return {
    year: data.year,
    currentValueAda: currentAda,
    targetValueAda: targetAda,
    percentUsed,
    epoch: data.epoch,
    updatedAt: data.updatedAt,
  };
}

/**
 * Fetch NCL data for all years
 * Returns: Array of NCL data with values in ADA
 */
export async function fetchNCLData(): Promise<NCLDisplayData[]> {
  const data = await fetchApi<NCLYearData[]>(API_ENDPOINTS.ncl);
  return data.map(transformNCLData);
}

/**
 * Fetch NCL data for the current year
 * Returns: NCL data for current year with values in ADA, or null if not found
 */
export async function fetchCurrentYearNCL(): Promise<NCLDisplayData | null> {
  const currentYear = new Date().getFullYear();
  try {
    const data = await fetchApi<NCLYearData>(API_ENDPOINTS.nclByYear(currentYear));
    return transformNCLData(data);
  } catch (error) {
    console.error(`Failed to fetch NCL data for year ${currentYear}:`, error);
    return null;
  }
}

/**
 * Fetch all governance actions for the dashboard
 * Returns: Array of governance actions with voting tallies
 */
export async function fetchGovernanceActions(): Promise<GovernanceAction[]> {
  const data = await fetchApi<GovernanceAction[]>(API_ENDPOINTS.proposals);

  // Transform API response to match frontend expected format
  return data.map(transformGovernanceAction);
}

/**
 * Fetch detailed governance action by ID
 * @param proposalId - Can be numeric ID, txHash, or txHash:certIndex
 * Returns: Full governance action detail with vote records
 */
export async function fetchGovernanceActionDetail(
  proposalId: string
): Promise<GovernanceActionDetail | null> {
  try {
    const data = await fetchApi<GovernanceActionDetail>(
      API_ENDPOINTS.proposalDetail(proposalId)
    );
    return transformGovernanceActionDetail(data);
  } catch (error) {
    console.error(`Failed to fetch proposal ${proposalId}:`, error);
    return null;
  }
}

/**
 * Convert lovelace string to formatted ADA string (divide by 1,000,000, round to integer, add commas)
 */
function lovelaceToAdaString(lovelace: string | undefined): string {
  if (!lovelace) return "0";
  const adaValue = Math.round(Number(lovelace) / 1_000_000);
  return adaValue.toLocaleString();
}

/**
 * Transform API governance action to frontend format
 * Maps API field names to frontend expected format
 * Converts lovelace values to ADA for display
 */
function transformGovernanceAction(action: GovernanceAction): GovernanceAction {
  // Convert lovelace to ADA for DRep
  const drepYesAda = lovelaceToAdaString(action.drep?.yesLovelace);
  const drepNoAda = lovelaceToAdaString(action.drep?.noLovelace);
  const drepAbstainAda = lovelaceToAdaString(action.drep?.abstainLovelace);

  // Convert lovelace to ADA for SPO
  const spoYesAda = action.spo ? lovelaceToAdaString(action.spo.yesLovelace) : undefined;
  const spoNoAda = action.spo ? lovelaceToAdaString(action.spo.noLovelace) : undefined;
  const spoAbstainAda = action.spo ? lovelaceToAdaString(action.spo.abstainLovelace) : undefined;

  return {
    // Keep original hash (txHash:certIndex format) for voting transactions
    // Use proposalId for display/routing (gov_action bech32 format)
    hash: action.hash,
    proposalId: action.proposalId,
    txHash: action.txHash,
    title: action.title || "Untitled Proposal",
    type: action.type,
    status: action.status,
    constitutionality: action.constitutionality || "Unspecified",

    // DRep voting data (required)
    drepYesPercent: action.drep?.yesPercent ?? 0,
    drepNoPercent: action.drep?.noPercent ?? 0,
    drepAbstainPercent: action.drep?.abstainPercent ?? 0,
    drepYesAda,
    drepNoAda,
    drepAbstainAda,

    // SPO voting data (optional)
    spoYesPercent: action.spo?.yesPercent,
    spoNoPercent: action.spo?.noPercent,
    spoAbstainPercent: action.spo?.abstainPercent,
    spoYesAda,
    spoNoAda,
    spoAbstainAda,

    // CC voting data (optional)
    ccYesPercent: action.cc?.yesPercent,
    ccNoPercent: action.cc?.noPercent,
    ccAbstainPercent: action.cc?.abstainPercent,
    ccYesCount: action.cc?.yesCount,
    ccNoCount: action.cc?.noCount,
    ccAbstainCount: action.cc?.abstainCount,

    // Vote totals
    totalYes: action.totalYes ?? 0,
    totalNo: action.totalNo ?? 0,
    totalAbstain: action.totalAbstain ?? 0,

    // Epoch data
    submissionEpoch: action.submissionEpoch ?? 0,
    expiryEpoch: action.expiryEpoch ?? 0,

    // Pass through raw API data for completeness
    drep: action.drep,
    spo: action.spo,
    cc: action.cc,
  };
}

/**
 * Transform API governance action detail to frontend format
 */
function transformGovernanceActionDetail(
  detail: GovernanceActionDetail
): GovernanceActionDetail {
  const base = transformGovernanceAction(detail);

  return {
    ...base,
    description: detail.description,
    rationale: detail.rationale,
    votes: detail.votes?.map(transformVoteRecord) ?? [],
    ccVotes: detail.ccVotes?.map(transformVoteRecord) ?? [],
  };
}

/**
 * Transform API vote record to frontend format
 */
function transformVoteRecord(vote: VoteRecord): VoteRecord {
  return {
    voterType: vote.voterType,
    voterId: vote.voterId,
    voterName: vote.voterName,
    drepId: vote.voterId || vote.drepId, // For backwards compatibility
    drepName: vote.voterName || vote.voterId || vote.drepName,
    vote: vote.vote,
    votingPower: vote.votingPower ?? "0",
    votingPowerAda: vote.votingPowerAda ?? 0,
    anchorUrl: vote.anchorUrl,
    anchorHash: vote.anchorHash,
    votedAt: vote.votedAt,
  };
}

/**
 * Fetch sentiment summary for a proposal filtered by DRep
 * @param proposalId - The proposal ID (gov_action bech32 or txHash:certIndex)
 * @param drepId - The DRep ID (CIP-105 format)
 * @param token - JWT token for authentication
 * Returns: Sentiment summary with yes/no/abstain counts
 */
export async function fetchSentiment(
  proposalId: string,
  drepId: string,
  token: string
): Promise<SentimentResponse | null> {
  try {
    return await fetchApiWithAuth<SentimentResponse>(
      API_ENDPOINTS.sentiment(proposalId, drepId),
      token
    );
  } catch (error) {
    console.error(`Failed to fetch sentiment for proposal ${proposalId}:`, error);
    return null;
  }
}

/**
 * Fetch individual sentiment reactions for a proposal filtered by DRep
 * @param proposalId - The proposal ID
 * @param drepId - The DRep ID
 * @param token - JWT token for authentication
 * Returns: Individual reactions with delegator details
 */
export async function fetchSentimentReactions(
  proposalId: string,
  drepId: string,
  token: string
): Promise<SentimentReactionsResponse | null> {
  try {
    return await fetchApiWithAuth<SentimentReactionsResponse>(
      API_ENDPOINTS.sentimentReactions(proposalId, drepId),
      token
    );
  } catch (error) {
    console.error(`Failed to fetch sentiment reactions for proposal ${proposalId}:`, error);
    return null;
  }
}

// ============================================================================
// Auth API Functions
// ============================================================================

import type {
  SignInResponse,
  AuthMeResponse,
  ClaimDrepResponse,
  ApiKeyResponse,
  ResetApiKeyResponse,
  DrepRegisterRequest,
  DrepRegisterResponse,
  DrepStatusResponse,
} from "@/types/auth";

/**
 * Generic POST fetch wrapper with error handling
 */
async function postApi<T>(
  url: string,
  body: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API Error (${response.status})`);
  }

  return data;
}

/**
 * Generic GET fetch wrapper with JWT token
 */
async function fetchApiWithAuth<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API Error (${response.status})`);
  }

  return data;
}

/**
 * Sign in with wallet address and signature
 * Sends signature to backend for verification before JWT generation
 */
export async function signIn(
  walletAddress: string,
  signature: { signature: string; key: string },
  nonce: string
): Promise<SignInResponse> {
  return postApi<SignInResponse>(API_ENDPOINTS.authSignIn, {
    walletAddress,
    signature,
    nonce,
  });
}

/**
 * Get current user profile
 * Requires JWT token
 */
export async function getMe(token: string): Promise<AuthMeResponse> {
  return fetchApiWithAuth<AuthMeResponse>(API_ENDPOINTS.authMe, token);
}

/**
 * Claim a DRep registration
 * Links authenticated user to a DRep registration
 */
export async function claimDrep(
  token: string,
  drepId: string
): Promise<ClaimDrepResponse> {
  return postApi<ClaimDrepResponse>(
    API_ENDPOINTS.authClaimDrep,
    { drepId },
    token
  );
}

/**
 * Get DRep API key
 * Only for linked and approved DReps
 */
export async function getApiKey(token: string): Promise<ApiKeyResponse> {
  return fetchApiWithAuth<ApiKeyResponse>(API_ENDPOINTS.authApiKey, token);
}

/**
 * Reset DRep API key
 * Self-service for approved DReps
 */
export async function resetApiKey(token: string): Promise<ResetApiKeyResponse> {
  return postApi<ResetApiKeyResponse>(API_ENDPOINTS.authResetApiKey, {}, token);
}

/**
 * Register a new DRep
 * Requires JWT authentication - verifies DRep ownership on backend
 * Creates a PENDING registration
 */
export async function registerDrep(
  token: string,
  data: DrepRegisterRequest
): Promise<DrepRegisterResponse> {
  return postApi<DrepRegisterResponse>(API_ENDPOINTS.drepRegister, data, token);
}

/**
 * Get DRep registration status
 * Public endpoint - no auth required
 */
export async function getDrepStatus(
  drepId: string
): Promise<DrepStatusResponse> {
  return fetchApi<DrepStatusResponse>(API_ENDPOINTS.drepStatus(drepId));
}

// ============================================================================
// Admin API Functions
// ============================================================================

import type {
  AdminCheckResponse,
  AdminListDrepsResponse,
  AdminApproveDrepRequest,
  AdminApproveDrepResponse,
  AdminRejectDrepRequest,
  AdminRejectDrepResponse,
} from "@/types/auth";

/**
 * Check if current user has admin privileges
 * Returns 200 if admin, 403 if not
 */
export async function checkAdminStatus(token: string): Promise<AdminCheckResponse> {
  return fetchApiWithAuth<AdminCheckResponse>(API_ENDPOINTS.adminCheck, token);
}

/**
 * List all DRep registrations (admin only)
 * @param token JWT token
 * @param status Optional filter by status
 */
export async function listDrepRegistrations(
  token: string,
  status?: "PENDING" | "APPROVED" | "REJECTED"
): Promise<AdminListDrepsResponse> {
  const url = status
    ? `${API_ENDPOINTS.adminListDreps}?status=${status}`
    : API_ENDPOINTS.adminListDreps;
  return fetchApiWithAuth<AdminListDrepsResponse>(url, token);
}

/**
 * Approve a DRep registration (admin only)
 */
export async function approveDrep(
  token: string,
  drepId: string,
  data: AdminApproveDrepRequest
): Promise<AdminApproveDrepResponse> {
  return postApi<AdminApproveDrepResponse>(
    API_ENDPOINTS.adminApproveDrep(drepId),
    data,
    token
  );
}

/**
 * Reject a DRep registration (admin only)
 */
export async function rejectDrep(
  token: string,
  drepId: string,
  data: AdminRejectDrepRequest
): Promise<AdminRejectDrepResponse> {
  return postApi<AdminRejectDrepResponse>(
    API_ENDPOINTS.adminRejectDrep(drepId),
    data,
    token
  );
}