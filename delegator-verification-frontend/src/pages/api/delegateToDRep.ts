import { delegateToDRep } from "@/lib/cardano/delegateToDRep";
import type { NextApiRequest, NextApiResponse } from "next";

type Data =
  | {
      message: string;
      data?: {
        unsignedTx: string;
      };
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    if (req.method !== "POST") {
      return res.status(422).json({ error: "Only POST requests allowed" });
    }

    const { rewardAddress, utxos, changeAddress, actions } = req.body;

    if (!rewardAddress || !utxos || !changeAddress || !actions) {
      return res.status(400).json({
        error: "rewardAddress, utxos, changeAddress, and actions are required",
      });
    }

    const { unsignedTx } = await delegateToDRep({
      rewardAddress,
      utxos,
      changeAddress,
      actions,
    });

    if (unsignedTx) {
      return res.status(200).json({
        message: "Transaction built successfully",
        data: { unsignedTx },
      });
    } else {
      return res.status(500).json({
        error: "Failed to build transaction",
      });
    }
  } catch (error) {
    console.error("Error in delegateToDRep API:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
