import { BlockfrostProvider } from "@meshsdk/core";

const blockfrostApiKey = process.env.BLOCKFROST_KEY!;
const drepId = process.env.NEXT_PUBLIC_DREP_ID!;

const blockchainProvider = new BlockfrostProvider(blockfrostApiKey);

export interface DelegationStatus {
  isRegistered: boolean;
  isDRepDelegated: boolean;
  currentDRepId: string | null;
  liveStake: string | null;
}

/**
 * Check if a stake address is delegating to the configured DRep
 */
export const checkDelegation = async (
  stakeAddress: string
): Promise<DelegationStatus> => {
  try {
    const info = await blockchainProvider.get(`/accounts/${stakeAddress}`);
    const { active, drep_id, controlled_amount } = info;

    if (!active) {
      return {
        isRegistered: false,
        isDRepDelegated: false,
        currentDRepId: null,
        liveStake: null,
      };
    }

    return {
      isRegistered: active,
      isDRepDelegated: drep_id === drepId,
      currentDRepId: drep_id || null,
      liveStake: controlled_amount || null,
    };
  } catch (error) {
    console.error("Error checking delegation status:", error);
    throw new Error("Failed to check delegation status");
  }
};
