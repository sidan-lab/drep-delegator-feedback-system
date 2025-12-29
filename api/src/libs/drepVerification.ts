/**
 * DRep Ownership Verification
 * Verifies that a wallet owns a DRep ID by checking the payment address
 * stored in our Drep table (synced from Koios)
 */

import { prisma } from "../services";

/**
 * Verify that a wallet owns a DRep ID
 *
 * Checks if the user's wallet address matches the DRep's payment address
 * stored in our database (synced from Koios drep_updates metadata)
 *
 * @param walletAddress - The user's wallet address (addr1... or addr_test1...)
 * @param drepId - The DRep ID to verify (drep1...)
 * @returns Object with verification result and details
 */
export async function verifyDrepOwnership(
  walletAddress: string,
  drepId: string
): Promise<{
  verified: boolean;
  error?: string;
  isScriptBased?: boolean;
}> {
  // Validate inputs
  if (!walletAddress || !drepId) {
    return { verified: false, error: "Missing wallet address or DRep ID" };
  }

  // Check wallet address format
  const isPaymentAddress =
    walletAddress.startsWith("addr1") || walletAddress.startsWith("addr_test1");

  if (!isPaymentAddress) {
    return { verified: false, error: "Invalid wallet address format. Expected payment address (addr1...)" };
  }

  // Check DRep ID format
  if (!drepId.startsWith("drep1") && !drepId.startsWith("drep_script1")) {
    return { verified: false, error: "Invalid DRep ID format" };
  }

  // Script-based DReps cannot be verified automatically
  if (drepId.startsWith("drep_script1")) {
    return {
      verified: false,
      error:
        "Script-based DReps cannot be automatically verified. Please contact admin for manual verification.",
      isScriptBased: true,
    };
  }

  try {
    // Look up DRep in our database
    const drep = await prisma.drep.findUnique({
      where: { drepId },
      select: {
        drepId: true,
        name: true,
        paymentAddress: true,
      },
    });

    if (!drep) {
      return {
        verified: false,
        error:
          "DRep not found in our database. Please ensure you have registered as a DRep on-chain and wait for the next sync cycle.",
      };
    }

    if (!drep.paymentAddress) {
      return {
        verified: false,
        error:
          "DRep has no payment address in metadata. Please update your DRep metadata to include a payment address, or contact admin for manual verification.",
      };
    }

    // Compare wallet address with DRep's payment address (case-insensitive)
    const isMatch =
      walletAddress.toLowerCase() === drep.paymentAddress.toLowerCase();

    if (!isMatch) {
      console.log(`[DRep Verification] Address mismatch:`);
      console.log(`  User wallet: ${walletAddress}`);
      console.log(`  DRep payment address: ${drep.paymentAddress}`);
      return {
        verified: false,
        error:
          "Wallet address does not match this DRep's registered payment address. Please connect the wallet that matches the payment address in your DRep metadata.",
      };
    }

    console.log(
      `[DRep Verification] Verified ownership: ${drepId} (${drep.name || "unnamed"}) owned by ${walletAddress}`
    );
    return { verified: true };
  } catch (error) {
    console.error("[DRep Verification] Database error:", error);
    return {
      verified: false,
      error: "Failed to verify DRep ownership. Please try again later.",
    };
  }
}
