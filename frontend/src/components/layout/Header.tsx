import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet";
import { Users } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Cardano Governance All-In-One Platform
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/drep/register"
                className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 hover:border-primary/60 hover:from-primary/30 hover:to-purple-500/30 transition-all duration-300"
              >
                <Users className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  DRep Delegator Feedback Integration
                </span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ConnectWalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
