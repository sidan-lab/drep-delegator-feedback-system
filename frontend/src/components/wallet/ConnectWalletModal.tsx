import { useWallet } from "@meshsdk/react";
import { BrowserWallet, type Wallet } from "@meshsdk/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Wallet as WalletIcon,
  LogOut,
  ExternalLink,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const { connect, disconnect, connected, name, wallet } = useWallet();
  const {
    isAuthenticated,
    isLoading: authLoading,
    signIn,
    signOut,
    drepRegistration,
  } = useAuth();
  const [availableWallets, setAvailableWallets] = useState<Wallet[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already attempted auto sign-in for this connection
  const hasAttemptedAutoSignIn = useRef(false);

  // Detect all available CIP-30 wallets using Mesh SDK
  useEffect(() => {
    const loadWallets = async () => {
      const wallets = await BrowserWallet.getAvailableWallets();
      // Sort alphabetically by name
      setAvailableWallets(wallets.sort((a, b) => a.name.localeCompare(b.name)));
    };
    loadWallets();
  }, [isOpen]);

  // Get wallet address when connected and authenticated
  // Only fetch after successful authentication to avoid "no account set" errors
  useEffect(() => {
    let isMounted = true;

    async function getAddress() {
      // Only try to get address after authenticated (wallet is confirmed ready)
      if (connected && wallet && isAuthenticated) {
        try {
          // Get payment address (used for DRep verification)
          const addresses = await wallet.getUsedAddresses();
          if (isMounted && addresses.length > 0) {
            setWalletAddress(addresses[0]);
          } else {
            // Fallback to change address if no used addresses
            const changeAddr = await wallet.getChangeAddress();
            if (isMounted) {
              setWalletAddress(changeAddr);
            }
          }
        } catch (err) {
          console.warn("Failed to get wallet address:", err);
        }
      } else if (!connected) {
        setWalletAddress("");
      }
    }
    getAddress();

    return () => {
      isMounted = false;
    };
  }, [connected, wallet, isAuthenticated]);

  // Reset auto sign-in attempt flag when wallet disconnects
  useEffect(() => {
    if (!connected) {
      hasAttemptedAutoSignIn.current = false;
    }
  }, [connected]);

  // Auto sign-in after wallet connects (if not already authenticated)
  // Simplified flow: connected = wallet connected + authenticated
  // If sign-in fails or is declined, disconnect the wallet
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const autoSignIn = async () => {
      // Only attempt once per connection session
      if (
        connected &&
        wallet &&
        !isAuthenticated &&
        !authLoading &&
        !isSigningIn &&
        !hasAttemptedAutoSignIn.current
      ) {
        hasAttemptedAutoSignIn.current = true;
        // Add a small delay to let wallet state stabilize after connection
        timeoutId = setTimeout(async () => {
          setIsSigningIn(true);
          setError(null);
          try {
            await signIn();
          } catch (err) {
            console.error("Auto sign-in failed:", err);
            const errorMessage =
              err instanceof Error
                ? err.message
                : "Failed to authenticate wallet";

            // Check if user declined
            const isUserDeclined =
              errorMessage.toLowerCase().includes("declined") ||
              errorMessage.toLowerCase().includes("cancelled") ||
              errorMessage.toLowerCase().includes("canceled") ||
              errorMessage.toLowerCase().includes("rejected");

            // Disconnect wallet on any sign-in failure
            // Simplified flow: no intermediate "connected but not authenticated" state
            disconnect();

            // Only show error for non-user-declined failures
            if (!isUserDeclined) {
              setError(errorMessage);
            }
          } finally {
            setIsSigningIn(false);
          }
        }, 500); // 500ms delay to let wallet state settle
      }
    };
    autoSignIn();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connected, wallet, isAuthenticated, authLoading, isSigningIn, signIn, disconnect]);

  const handleConnect = useCallback(
    async (walletName: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        await connect(walletName);
        // Auth sign-in will be triggered by the useEffect above
      } catch (err) {
        console.error("Wallet connection error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";

        // Handle specific wallet errors
        if (errorMessage.toLowerCase().includes("no account set")) {
          setError("Please select an account in your wallet and try again");
        } else if (errorMessage.toLowerCase().includes("user rejected") ||
                   errorMessage.toLowerCase().includes("user denied")) {
          // User cancelled - don't show error
          setError(null);
        } else {
          setError(errorMessage);
        }
        setIsConnecting(false);
      }
    },
    [connect]
  );

  // Reset connecting state when sign-in completes or fails
  useEffect(() => {
    if (!isSigningIn && isConnecting) {
      setIsConnecting(false);
      if (isAuthenticated) {
        onClose();
      }
    }
  }, [isSigningIn, isConnecting, isAuthenticated, onClose]);

  const handleDisconnect = useCallback(async () => {
    disconnect();
    signOut();
    setWalletAddress("");
    onClose();
  }, [disconnect, signOut, onClose]);

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon className="h-5 w-5" />
            {connected ? "Wallet Connected" : "Connect Wallet"}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? "Your wallet is connected. You can now manage your delegator sentiment display and vote on governance actions."
              : "Connect your Cardano wallet to manage your delegator sentiment display and vote on governance actions."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {connected ? (
          <div className="space-y-4">
            {/* Wallet Connection Info */}
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
                    Wallet Address
                  </span>
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {formatAddress(walletAddress)}
                  </code>
                </div>
              )}
            </div>

            {/* Authentication Status */}
            {isSigningIn || !isAuthenticated ? (
              <div className="bg-primary/10 p-4 rounded-lg flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Authenticating...</p>
                  <p className="text-xs text-muted-foreground">
                    Please sign the message in your wallet
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-green-500/10 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-500">
                    Authenticated
                  </span>
                </div>
                {drepRegistration && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">DRep</span>
                    <span className="font-medium">
                      {drepRegistration.drepName ||
                        formatAddress(drepRegistration.drepId)}
                    </span>
                  </div>
                )}
              </div>
            )}

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
              <div className="space-y-2">
                {(isConnecting || isSigningIn) && (
                  <div className="bg-primary/10 p-4 rounded-lg flex items-center gap-3 mb-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {isSigningIn ? "Authenticating..." : "Connecting..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isSigningIn
                          ? "Please sign the message in your wallet"
                          : "Please approve the connection in your wallet"}
                      </p>
                    </div>
                  </div>
                )}
                {availableWallets.map((detectedWallet) => (
                  <button
                    key={detectedWallet.id}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleConnect(detectedWallet.id)}
                    disabled={isConnecting || isSigningIn}
                  >
                    {detectedWallet.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detectedWallet.icon}
                        alt={detectedWallet.name}
                        className="w-10 h-10 rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <WalletIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{detectedWallet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Connect and authenticate
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
