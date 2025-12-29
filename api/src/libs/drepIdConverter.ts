/**
 * DRep ID Format Converter
 *
 * Converts between CIP-105 (legacy) and CIP-129 DRep ID formats.
 *
 * CIP-105 (Legacy): drep1 + bech32(28-byte key_hash)
 * CIP-129 (New):    drep1 + bech32(type_byte + 28-byte key_hash)
 *
 * Type bytes:
 * - 0x22: Key hash DRep
 * - 0x23: Script hash DRep
 */

import { bech32 } from "bech32";

const DREP_KEY_HASH_TYPE = 0x22;
const DREP_SCRIPT_HASH_TYPE = 0x23;

/**
 * Check if a DRep ID is in CIP-129 format
 */
export function isCip129Format(drepId: string): boolean {
  if (!drepId.startsWith("drep1") && !drepId.startsWith("drep_script1")) {
    return false;
  }

  try {
    const decoded = bech32.decode(drepId, 100);
    const data = bech32.fromWords(decoded.words);

    // CIP-129 has 29 bytes (1 type byte + 28 byte hash)
    // CIP-105 has 28 bytes (just the hash)
    if (data.length === 29) {
      const typeByte = data[0];
      return typeByte === DREP_KEY_HASH_TYPE || typeByte === DREP_SCRIPT_HASH_TYPE;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a DRep ID is in CIP-105 (legacy) format
 */
export function isCip105Format(drepId: string): boolean {
  if (!drepId.startsWith("drep1")) {
    return false;
  }

  try {
    const decoded = bech32.decode(drepId, 100);
    const data = bech32.fromWords(decoded.words);

    // CIP-105 has exactly 28 bytes (just the hash, no type byte)
    return data.length === 28;
  } catch {
    return false;
  }
}

/**
 * Convert a CIP-105 (legacy) DRep ID to CIP-129 format
 * Returns the original if already CIP-129 or conversion fails
 */
export function cip105ToCip129(drepId: string): string {
  // If already CIP-129 format, return as-is
  if (isCip129Format(drepId)) {
    return drepId;
  }

  // Handle script DReps (drep_script1...) - these don't need conversion
  if (drepId.startsWith("drep_script1")) {
    return drepId;
  }

  if (!drepId.startsWith("drep1")) {
    console.warn(`[DRepID] Invalid DRep ID format: ${drepId}`);
    return drepId;
  }

  try {
    // Decode the CIP-105 bech32
    const decoded = bech32.decode(drepId, 100);
    const data = bech32.fromWords(decoded.words);

    // Verify it's 28 bytes (CIP-105 format)
    if (data.length !== 28) {
      console.warn(`[DRepID] Unexpected data length: ${data.length} (expected 28)`);
      return drepId;
    }

    // Prepend the key hash type byte (0x22)
    const cip129Data = new Uint8Array([DREP_KEY_HASH_TYPE, ...data]);

    // Re-encode to bech32
    const words = bech32.toWords(cip129Data);
    const cip129Id = bech32.encode("drep", words, 100);

    console.log(`[DRepID] Converted CIP-105 to CIP-129: ${drepId} -> ${cip129Id}`);
    return cip129Id;
  } catch (error) {
    console.error(`[DRepID] Failed to convert DRep ID: ${drepId}`, error);
    return drepId;
  }
}

/**
 * Convert a CIP-129 DRep ID to CIP-105 (legacy) format
 * Returns the original if already CIP-105 or conversion fails
 */
export function cip129ToCip105(drepId: string): string {
  // If already CIP-105 format, return as-is
  if (isCip105Format(drepId)) {
    return drepId;
  }

  // Handle script DReps - they don't have a CIP-105 equivalent
  if (drepId.startsWith("drep_script1")) {
    console.warn(`[DRepID] Script DReps don't have CIP-105 format: ${drepId}`);
    return drepId;
  }

  if (!drepId.startsWith("drep1")) {
    console.warn(`[DRepID] Invalid DRep ID format: ${drepId}`);
    return drepId;
  }

  try {
    // Decode the CIP-129 bech32
    const decoded = bech32.decode(drepId, 100);
    const data = bech32.fromWords(decoded.words);

    // Verify it's 29 bytes (CIP-129 format)
    if (data.length !== 29) {
      console.warn(`[DRepID] Unexpected data length: ${data.length} (expected 29)`);
      return drepId;
    }

    // Verify type byte
    const typeByte = data[0];
    if (typeByte !== DREP_KEY_HASH_TYPE && typeByte !== DREP_SCRIPT_HASH_TYPE) {
      console.warn(`[DRepID] Unexpected type byte: 0x${typeByte.toString(16)}`);
      return drepId;
    }

    // Remove the type byte to get the 28-byte hash
    const keyHash = data.slice(1);

    // Re-encode to bech32 without type byte
    const words = bech32.toWords(keyHash);
    const cip105Id = bech32.encode("drep", words, 100);

    console.log(`[DRepID] Converted CIP-129 to CIP-105: ${drepId} -> ${cip105Id}`);
    return cip105Id;
  } catch (error) {
    console.error(`[DRepID] Failed to convert DRep ID: ${drepId}`, error);
    return drepId;
  }
}

/**
 * Normalize a DRep ID to CIP-129 format (preferred storage format)
 * Accepts either CIP-105 or CIP-129 and returns CIP-129
 */
export function normalizeToCip129(drepId: string): string {
  if (!drepId) return drepId;
  return cip105ToCip129(drepId);
}

/**
 * Get both CIP-105 and CIP-129 formats for a DRep ID
 * Useful for database lookups that may have either format
 */
export function getBothFormats(drepId: string): { cip105: string; cip129: string } {
  if (!drepId) {
    return { cip105: drepId, cip129: drepId };
  }

  if (isCip129Format(drepId)) {
    return {
      cip129: drepId,
      cip105: cip129ToCip105(drepId),
    };
  }

  if (isCip105Format(drepId)) {
    return {
      cip105: drepId,
      cip129: cip105ToCip129(drepId),
    };
  }

  // If format is unknown, return as-is for both
  return { cip105: drepId, cip129: drepId };
}
