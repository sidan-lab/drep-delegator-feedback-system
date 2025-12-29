import { BrowserWallet } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { DelegateAction } from "../cardano/delegateToDRep";

/**
 * Custom hook to validate delegation status and handle delegation transactions
 */
export const useValidateDelegation = () => {
  const walletInfo = useWallet();

  const [wallet, setBrowserWallet] = useState<BrowserWallet | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string | null>(null);
  const [liveStake, setLiveStake] = useState<string | null>(null);

  const [error, setError] = useState<string>("");
  const [transactionLoading, setLoading] = useState(0);

  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isDRepDelegated, setIsDRepDelegated] = useState<boolean>(false);

  const resetState = () => {
    setIsDRepDelegated(false);
    setIsRegistered(false);
    setLiveStake(null);
  };

  const updateStateForConnect = () => {
    setIsDRepDelegated(true);
    setIsRegistered(true);
    setLoading(120); // 120 second countdown for transaction confirmation
  };

  // Countdown timer for transaction confirmation
  useEffect(() => {
    if (transactionLoading > 0) {
      const countdownInterval = setInterval(() => {
        setLoading((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [transactionLoading, setLoading]);

  /**
   * Check delegation status for a stake address
   */
  const checkDelegationStatus = async (stakeAddress: string) => {
    if (!stakeAddress) {
      setError("wallet_connect");
      return;
    }

    try {
      const response = await axios.post("/api/checkDelegation", {
        rewardAddress: stakeAddress,
      });

      const { status, data } = response;

      if (status === 422 || status === 500) {
        resetState();
        return;
      }

      const { isRegistered, isDRepDelegated, liveStake } = data.data;
      setIsDRepDelegated(isDRepDelegated);
      setIsRegistered(isRegistered);
      setLiveStake(liveStake);
    } catch (error) {
      console.error("Error checking delegation:", error);
      resetState();
      setError("wallet_connect");
    }
  };

  /**
   * Delegate to the configured DRep
   */
  const delegateToDRep = useCallback(async () => {
    if (!rewardAddress) {
      setError("wallet_connect");
      return;
    }
    if (!wallet) {
      setError("wallet_connect");
      return;
    }

    try {
      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      let actions: DelegateAction[] = [];
      if (!isRegistered) {
        actions.push("registerStakeAddress");
      }
      if (!isDRepDelegated) {
        actions.push("voteDelegation");
      }

      const response = await axios.post("/api/delegateToDRep", {
        rewardAddress,
        utxos,
        changeAddress,
        actions,
      });

      const { unsignedTx } = response.data.data;
      if (unsignedTx) {
        const signedTx = await wallet.signTx(unsignedTx);
        const txHash = await wallet.submitTx(signedTx);

        if (txHash) {
          console.log("Submitted delegation transaction:", txHash);
          updateStateForConnect();
        }
      }
    } catch (error) {
      setError("wallet_sign");
      console.error("Error delegating:", error);
      resetState();
    }
  }, [rewardAddress, wallet, isRegistered, isDRepDelegated]);

  // Initialize wallet and check delegation status when wallet connects
  useEffect(() => {
    setError("");
    if (walletInfo.name) {
      BrowserWallet.enable(walletInfo.name).then((wallet) => {
        setBrowserWallet(wallet);
        wallet.getRewardAddresses().then((addresses) => {
          if (addresses.length > 0 && addresses[0]) {
            setRewardAddress(addresses[0]);
            checkDelegationStatus(addresses[0]);
          }
        });
      });
    }
  }, [walletInfo.name]);

  return {
    rewardAddress,
    liveStake,
    delegateToDRep,
    error,
    wallet,
    isDRepDelegated,
    isRegistered,
    updateStateForConnect,
    transactionLoading,
    setLoading,
  };
};
