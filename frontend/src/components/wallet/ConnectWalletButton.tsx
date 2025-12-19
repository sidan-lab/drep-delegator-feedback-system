import { useWallet } from "@meshsdk/react";
import { Button } from "@/components/ui/button";
import { Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

export function ConnectWalletButton() {
  const { connected, connecting, name, wallet } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [walletIcon, setWalletIcon] = useState<string>("");

  // Get wallet address and icon when connected
  useEffect(() => {
    async function getWalletInfo() {
      if (connected && wallet) {
        try {
          // Try multiple methods to get an address
          let addr = "";

          // Method 1: Get used addresses
          try {
            const usedAddresses = await wallet.getUsedAddresses();
            if (usedAddresses && usedAddresses.length > 0) {
              addr = usedAddresses[0];
            }
          } catch {
            // Ignore and try next method
          }

          // Method 2: Get change address
          if (!addr) {
            try {
              const changeAddr = await wallet.getChangeAddress();
              if (changeAddr) {
                addr = changeAddr;
              }
            } catch {
              // Ignore and try next method
            }
          }

          // Method 3: Get unused addresses
          if (!addr) {
            try {
              const unusedAddresses = await wallet.getUnusedAddresses();
              if (unusedAddresses && unusedAddresses.length > 0) {
                addr = unusedAddresses[0];
              }
            } catch {
              // Ignore
            }
          }

          if (addr) {
            setAddress(addr);
          }

          // Get wallet icon from window.cardano
          if (typeof window !== "undefined" && name) {
            const cardano = (window as unknown as { cardano?: Record<string, { icon?: string }> }).cardano;
            if (cardano && cardano[name]?.icon) {
              setWalletIcon(cardano[name].icon);
            }
          }
        } catch (err) {
          console.error("Failed to get wallet info:", err);
        }
      } else {
        setAddress("");
        setWalletIcon("");
      }
    }
    getWalletInfo();
  }, [connected, wallet, name]);

  // Format address to show first 6 and last 5 characters
  const formatAddress = (addr: string) => {
    if (addr.length <= 15) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
  };

  // Determine button state
  const isLoading = connecting || (connected && authLoading);

  return (
    <>
      <Button
        variant={connected && isAuthenticated ? "outline" : "default"}
        onClick={() => setIsModalOpen(true)}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {connecting ? "Connecting..." : "Authenticating..."}
          </>
        ) : connected && isAuthenticated ? (
          <>
            {walletIcon ? (
              <Image
                src={walletIcon}
                alt={name || "wallet"}
                width={20}
                height={20}
                className="rounded"
              />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            <span>{address ? formatAddress(address) : name}</span>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </>
        ) : connected ? (
          <>
            {walletIcon ? (
              <Image
                src={walletIcon}
                alt={name || "wallet"}
                width={20}
                height={20}
                className="rounded"
              />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            <span>{address ? formatAddress(address) : name}</span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </>
        )}
      </Button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
