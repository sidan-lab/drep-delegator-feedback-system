import { useWallet } from "@meshsdk/react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ArrowLeft } from "lucide-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { NotificationPreferencesForm } from "./NotificationPreferencesForm";
import Link from "next/link";
import { useCallback } from "react";

export function NotificationSettingsContent() {
  const { connected, disconnect } = useWallet();
  const {
    isAuthenticated,
    isLoading: authLoading,
    walletAddress,
    signOut,
  } = useAuth();

  // Handle sign out
  const handleSignOut = useCallback(() => {
    disconnect();
    signOut();
  }, [disconnect, signOut]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <Link href="/drep/register" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to DRep Registration
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Notification Settings</h1>
          <p className="text-muted-foreground">
            Configure how you want to receive voting deadline reminders.
          </p>
        </div>

        <div className="space-y-6">
          {/* Loading State */}
          {!isAuthenticated && (authLoading || connected) && (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-muted-foreground">Authenticating...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Authenticated Status Bar */}
          {isAuthenticated && (
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Connected:</span>
                <code className="text-xs bg-background px-2 py-0.5 rounded">
                  {walletAddress?.substring(0, 12)}...
                  {walletAddress?.substring(walletAddress.length - 8)}
                </code>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          )}

          {/* Connect Wallet Prompt */}
          {!isAuthenticated && !authLoading && !connected && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Connect your wallet to manage your notification preferences.
                  </p>
                  <ConnectWalletButton />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Preferences Form */}
          {isAuthenticated && <NotificationPreferencesForm />}
        </div>
      </div>
    </div>
  );
}
