import { useValidateDelegation } from "@/lib/hooks/useValidateDelegation";
import { DELEGATE_TEXT, ERROR_TEXT, SUCCESS_TEXT } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useAddress, useWallet } from "@meshsdk/react";
import axios from "axios";
import { useEffect, useState } from "react";
import { Loading } from "./Loading";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
const DREP_ID = process.env.NEXT_PUBLIC_DREP_ID!;
const DISCORD_CHANNEL_LINK = process.env.NEXT_PUBLIC_DISCORD_CHANNEL_LINK!;

export interface VerifyButtonProps {
  discordId?: string;
}

export const VerifyButton = ({ discordId = "" }: VerifyButtonProps) => {
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [lovelace, setLovelace] = useState<string>("0");

  const {
    rewardAddress,
    liveStake,
    isDRepDelegated,
    error: walletError,
    transactionLoading: loading,
    setLoading,
    delegateToDRep,
  } = useValidateDelegation();

  const address = useAddress();
  const { wallet } = useWallet();

  // Get lovelace balance when wallet connects
  useEffect(() => {
    if (wallet) {
      wallet.getLovelace().then((value) => {
        setLovelace(value);
      });
    }
  }, [wallet]);

  // Update lovelace from liveStake when available
  useEffect(() => {
    if (liveStake) {
      setLovelace(liveStake);
    }
  }, [liveStake]);

  /**
   * Handle delegation button click
   */
  const onDelegate = async () => {
    if (walletError) {
      return;
    }
    await delegateToDRep();
  };

  /**
   * Handle verify/connect button click
   */
  const onVerify = async () => {
    // If already verified, redirect to Discord
    if (success) {
      if (!DISCORD_CHANNEL_LINK) {
        setError(ERROR_TEXT.REDIRECT);
        return;
      }
      return window.open(DISCORD_CHANNEL_LINK, "_blank");
    }

    // Safety check - should only be clickable when delegated
    if (walletError || !isDRepDelegated) {
      return;
    }

    // Submit verification to central API
    const requestBody = {
      drepId: DREP_ID,
      discordUserId: discordId,
      discordUsername: "", // Will be filled by Discord bot
      stakeAddress: rewardAddress,
      liveStake: lovelace,
    };

    try {
      const result = await axios.post(
        `${API_BASE_URL}/sentiment/delegator/verify`,
        requestBody,
        {
          headers: {
            "X-API-Key": API_KEY,
          },
        }
      );

      if (result.data.success) {
        setError("");
        setSuccess(SUCCESS_TEXT.API);
      } else {
        setError(result.data.message || ERROR_TEXT.API);
        setSuccess("");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      setError(error.response?.data?.message || ERROR_TEXT.API);
      setSuccess("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Loading state during transaction */}
      {loading > 0 && (
        <div className="flex justify-center flex-col items-center w-full p-4">
          <Loading />
          <span className="mt-4">{`Waiting for transaction confirmation... ${loading}s`}</span>
          <span className="text-sm text-gray-400 mt-2">
            You can{" "}
            <button
              className="text-teal-400 underline hover:text-teal-300"
              onClick={() => setLoading(0)}
            >
              skip the timer
            </button>{" "}
            or come back later after confirmation
          </span>
        </div>
      )}

      {/* Show delegate button if not delegated */}
      {!isDRepDelegated ? (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onDelegate}
            disabled={!!walletError || loading > 0}
            className={cn(
              "z-10 h-full whitespace-nowrap bg-gray-800 rounded-xl border border-white transition px-8 py-4 font-semibold",
              {
                "cursor-not-allowed opacity-50": walletError || loading > 0,
                "cursor-pointer hover:scale-105 hover:bg-gray-700":
                  !walletError && loading === 0,
              }
            )}
          >
            {walletError ? "Wallet Error" : DELEGATE_TEXT}
          </button>
          <p className="text-sm text-gray-400 max-w-md text-center">
            You need to delegate to this DRep before you can verify your status.
          </p>
        </div>
      ) : (
        /* Show verify button when delegated */
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onVerify}
            disabled={!!walletError || loading > 0}
            className={cn(
              "z-10 h-full whitespace-nowrap rounded-xl border transition px-8 py-4 font-semibold",
              {
                "cursor-not-allowed opacity-50 bg-gray-600 text-gray-400 border-gray-500":
                  walletError || loading > 0,
                "cursor-pointer hover:scale-105 bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500":
                  !walletError && loading === 0 && !success,
                "cursor-pointer hover:scale-105 bg-blue-600 hover:bg-blue-500 text-white border-blue-500":
                  success,
              }
            )}
          >
            {success ? "Continue in Discord" : "Verify & Connect to Discord"}
          </button>

          {/* Show stake info */}
          {liveStake && (
            <p className="text-sm text-gray-400">
              Your stake:{" "}
              <span className="text-white font-mono">
                {(parseInt(liveStake) / 1_000_000).toLocaleString()} ADA
              </span>
            </p>
          )}
        </div>
      )}

      {/* Success message */}
      {success && <p className="text-success font-semibold">{success}</p>}

      {/* Error messages */}
      {error && <p className="text-danger">{error}</p>}

      {walletError && (
        <p className="text-danger">
          {walletError === "wallet_sign"
            ? ERROR_TEXT.WALLET_SIGN
            : ERROR_TEXT.WALLET_CONNECT}
        </p>
      )}
    </div>
  );
};
