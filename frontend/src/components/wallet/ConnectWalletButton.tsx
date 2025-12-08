import { useWallet } from "@meshsdk/react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { ConnectWalletModal } from "./ConnectWalletModal";

export function ConnectWalletButton() {
  const { connected, connecting, name } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={connected ? "outline" : "default"}
        onClick={() => setIsModalOpen(true)}
        disabled={connecting}
        className="flex items-center gap-2"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? (
          "Connecting..."
        ) : connected ? (
          <span className="capitalize">{name}</span>
        ) : (
          "Connect Wallet"
        )}
      </Button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
