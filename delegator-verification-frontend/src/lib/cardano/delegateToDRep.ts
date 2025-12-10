import {
  BlockfrostProvider,
  MeshTxBuilder,
  UTxO,
} from "@meshsdk/core";

const blockfrostApiKey = process.env.BLOCKFROST_KEY!;
const drepId = process.env.NEXT_PUBLIC_DREP_ID!;

const blockchainProvider = new BlockfrostProvider(blockfrostApiKey);

export type DelegateAction = "registerStakeAddress" | "voteDelegation";

export interface DelegateToDRepParams {
  rewardAddress: string;
  utxos: UTxO[];
  changeAddress: string;
  actions: DelegateAction[];
}

/**
 * Build an unsigned transaction to delegate to the configured DRep
 */
export const delegateToDRep = async ({
  rewardAddress,
  utxos,
  changeAddress,
  actions,
}: DelegateToDRepParams): Promise<{ unsignedTx: string }> => {
  if (!rewardAddress) {
    throw new Error("Reward address is required");
  }

  const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    evaluator: blockchainProvider,
  });

  for (const action of actions) {
    if (action === "registerStakeAddress") {
      txBuilder.registerStakeCertificate(rewardAddress);
    }

    if (action === "voteDelegation") {
      txBuilder.voteDelegationCertificate(
        { dRepId: drepId },
        rewardAddress
      );
    }
  }

  txBuilder.selectUtxosFrom(utxos);
  txBuilder.changeAddress(changeAddress);

  try {
    const unsignedTx = await txBuilder.complete();
    return { unsignedTx };
  } catch (error) {
    console.error("Error building delegation transaction:", error);
    throw new Error("Failed to build delegation transaction");
  }
};
