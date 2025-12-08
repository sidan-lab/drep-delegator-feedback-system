import { useWallet } from "@meshsdk/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { Wallet, LogOut, ExternalLink } from "lucide-react";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Supported wallets for Cardano governance
const SUPPORTED_WALLETS = [
  { name: "eternl", displayName: "Eternl" },
  { name: "nami", displayName: "Nami" },
  { name: "lace", displayName: "Lace" },
  { name: "flint", displayName: "Flint" },
  { name: "typhoncip30", displayName: "Typhon" },
  { name: "yoroi", displayName: "Yoroi" },
  { name: "gerowallet", displayName: "GeroWallet" },
  { name: "nufi", displayName: "NuFi" },
];

export function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const { connect, disconnect, connected, name, wallet } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect available wallets
  useEffect(() => {
    if (typeof window !== "undefined") {
      const detected: string[] = [];
      const cardano = (window as unknown as { cardano?: Record<string, unknown> }).cardano;
      if (cardano) {
        SUPPORTED_WALLETS.forEach(({ name }) => {
          // Check if wallet extension is installed
          if (cardano[name]) {
            detected.push(name);
          }
        });
      }
      setAvailableWallets(detected);
    }
  }, [isOpen]);

  // Get wallet address when connected
  useEffect(() => {
    async function getAddress() {
      if (connected && wallet) {
        try {
          const addresses = await wallet.getRewardAddresses();
          if (addresses.length > 0) {
            setWalletAddress(addresses[0]);
          }
        } catch (err) {
          console.error("Failed to get wallet address:", err);
        }
      } else {
        setWalletAddress("");
      }
    }
    getAddress();
  }, [connected, wallet]);

  const handleConnect = useCallback(
    async (walletName: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await connect(walletName);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to connect wallet"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [connect, onClose]
  );

  const handleDisconnect = useCallback(async () => {
    disconnect();
    setWalletAddress("");
    onClose();
  }, [disconnect, onClose]);

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {connected ? "Wallet Connected" : "Connect Wallet"}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? "Your wallet is connected. You can now vote on governance actions."
              : "Connect your Cardano wallet to vote on governance actions."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {connected ? (
          <div className="space-y-4">
            <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Connected Wallet
                </span>
                <span className="text-sm font-medium capitalize">{name}</span>
              </div>
              {walletAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Stake Address
                  </span>
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {formatAddress(walletAddress)}
                  </code>
                </div>
              )}
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDisconnect}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect Wallet
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {availableWallets.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-muted-foreground">
                  No Cardano wallets detected
                </p>
                <p className="text-sm text-muted-foreground">
                  Please install a Cardano wallet extension to continue.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <a
                    href="https://eternl.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Eternl <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://namiwallet.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Nami <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.lace.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Lace <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select a wallet to connect:
                </p>
                {SUPPORTED_WALLETS.filter((w) =>
                  availableWallets.includes(w.name)
                ).map((wallet) => (
                  <Button
                    key={wallet.name}
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => handleConnect(wallet.name)}
                    disabled={isLoading}
                  >
                    <span className="capitalize">{wallet.displayName}</span>
                  </Button>
                ))}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
