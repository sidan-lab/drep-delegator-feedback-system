/**
 * Auth Types
 * Type definitions for authentication and DRep registration
 */

export interface DrepRegistrationInfo {
  id: string;
  drepId: string;
  drepName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface AuthUser {
  userId: string;
  walletAddress: string | null;
  drepRegistration: DrepRegistrationInfo | null;
}

export interface SignInResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    token: string;
    isFirstTime: boolean;
    drepRegistration: DrepRegistrationInfo | null;
  };
}

export interface AuthMeResponse {
  success: boolean;
  data: AuthUser;
}

export interface ClaimDrepResponse {
  success: boolean;
  message: string;
  data: {
    drepId: string;
    drepName: string | null;
    status: string;
    hasApiKey: boolean;
  };
}

export interface ApiKeyResponse {
  success: boolean;
  data: {
    drepId: string;
    apiKey: string;
  };
}

export interface ResetApiKeyResponse {
  success: boolean;
  message: string;
  data: {
    drepId: string;
    apiKey: string;
  };
}

export interface DrepRegisterRequest {
  drepId: string;
  discordGuildId: string;
  drepName?: string;
  contactEmail?: string;
}

export interface DrepRegisterResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    drepId: string;
    discordGuildId: string;
    drepName: string | null;
    status: string;
  };
}

export interface DrepStatusResponse {
  success: boolean;
  data: {
    drepId: string;
    discordGuildId: string | null;
    drepName: string | null;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    rationale: string | null;
  };
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  data?: unknown;
}

// Admin types
export interface AdminDrepRegistration {
  id: string;
  drepId: string;
  discordGuildId: string | null;
  drepName: string | null;
  contactEmail: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rationale: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminListDrepsResponse {
  success: boolean;
  data: AdminDrepRegistration[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface AdminCheckResponse {
  success: boolean;
  message: string;
}

export interface AdminApproveDrepRequest {
  rationale?: string;
}

export interface AdminApproveDrepResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    drepId: string;
    drepName: string | null;
    status: string;
    apiKey: string;
    reviewedAt: string;
  };
}

export interface AdminRejectDrepRequest {
  rationale: string;
}

export interface AdminRejectDrepResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    drepId: string;
    status: string;
    rationale: string;
  };
}
