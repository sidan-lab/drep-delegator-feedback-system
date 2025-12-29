import { checkDelegation } from "@/lib/cardano/checkDelegation";
import type { NextApiRequest, NextApiResponse } from "next";

type Body = {
  rewardAddress: string;
};

type Data =
  | {
      message: string;
      data?: {
        isRegistered: boolean;
        isDRepDelegated: boolean;
        currentDRepId: string | null;
        liveStake: string | null;
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

    const { rewardAddress }: Body = req.body;

    if (!rewardAddress) {
      return res.status(400).json({ error: "rewardAddress is required" });
    }

    const { isRegistered, isDRepDelegated, currentDRepId, liveStake } =
      await checkDelegation(rewardAddress);

    if (isDRepDelegated) {
      return res.status(200).json({
        message: "Delegated to this DRep",
        data: {
          isRegistered,
          isDRepDelegated,
          currentDRepId,
          liveStake,
        },
      });
    } else if (isRegistered) {
      return res.status(200).json({
        message: "Registered but not delegated to this DRep",
        data: {
          isRegistered,
          isDRepDelegated,
          currentDRepId,
          liveStake,
        },
      });
    } else {
      return res.status(200).json({
        message: "Not registered",
        data: {
          isRegistered,
          isDRepDelegated,
          currentDRepId,
          liveStake,
        },
      });
    }
  } catch (error) {
    console.error("Error in checkDelegation API:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
