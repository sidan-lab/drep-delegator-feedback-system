import crypto from "crypto";

/**
 * Generate a secure API key for DRep authentication
 * Format: drep_sk_<32 random hex characters>
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `drep_sk_${randomBytes.toString("hex")}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^drep_sk_[a-f0-9]{64}$/.test(apiKey);
}
