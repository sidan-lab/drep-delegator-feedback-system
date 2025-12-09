import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet";

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Cardano Governance All-In-One Platform
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <ConnectWalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
