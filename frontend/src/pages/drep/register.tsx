import { useState, useCallback, useEffect } from "react";
import Head from "next/head";
import { useWallet } from "@meshsdk/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import {
  Check,
  Copy,
  RefreshCw,
  AlertCircle,
  Clock,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Shield,
  CheckCircle,
  Ban,
} from "lucide-react";
import {
  getApiKey,
  resetApiKey,
  registerDrep,
  checkAdminStatus,
  listDrepRegistrations,
  approveDrep,
  rejectDrep,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import type { AdminDrepRegistration } from "@/types/auth";

export default function DrepRegisterPage() {
  const { connected, disconnect } = useWallet();
  const {
    isAuthenticated,
    isLoading: authLoading,
    jwtToken,
    walletAddress,
    drepRegistration,
    signOut,
    updateDrepRegistration,
  } = useAuth();

  // Registration form state
  const [registerDrepId, setRegisterDrepId] = useState("");
  const [registerDiscordGuildId, setRegisterDiscordGuildId] = useState("");
  const [registerDrepName, setRegisterDrepName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // API Key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
  const [isResettingApiKey, setIsResettingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRegistrations, setAdminRegistrations] = useState<
    AdminDrepRegistration[]
  >([]);
  const [adminFilter, setAdminFilter] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "ALL"
  >("PENDING");
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Approve dialog state
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingDrep, setApprovingDrep] =
    useState<AdminDrepRegistration | null>(null);
  const [approveRationale, setApproveRationale] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingDrep, setRejectingDrep] =
    useState<AdminDrepRegistration | null>(null);
  const [rejectRationale, setRejectRationale] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Check admin status when authenticated
  useEffect(() => {
    const checkAdmin = async () => {
      if (!jwtToken) {
        setIsAdmin(false);
        return;
      }

      try {
        await checkAdminStatus(jwtToken);
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [jwtToken]);

  // Load admin registrations when admin and filter changes
  useEffect(() => {
    const loadRegistrations = async () => {
      if (!isAdmin || !jwtToken) return;

      setIsLoadingAdmin(true);
      setAdminError(null);
      try {
        const status = adminFilter === "ALL" ? undefined : adminFilter;
        const response = await listDrepRegistrations(jwtToken, status);
        if (response.success) {
          setAdminRegistrations(response.data);
        }
      } catch (error) {
        setAdminError(
          error instanceof Error
            ? error.message
            : "Failed to load registrations"
        );
      } finally {
        setIsLoadingAdmin(false);
      }
    };

    loadRegistrations();
  }, [isAdmin, jwtToken, adminFilter]);

  // Handle approve DRep
  const handleApproveDrep = async () => {
    if (!jwtToken || !approvingDrep) return;

    setIsApproving(true);
    setApproveError(null);
    try {
      await approveDrep(jwtToken, approvingDrep.drepId, {
        rationale: approveRationale.trim() || undefined,
      });
      setShowApproveDialog(false);
      setApprovingDrep(null);
      setApproveRationale("");
      // Refresh the list
      const status = adminFilter === "ALL" ? undefined : adminFilter;
      const response = await listDrepRegistrations(jwtToken, status);
      if (response.success) {
        setAdminRegistrations(response.data);
      }
    } catch (error) {
      setApproveError(
        error instanceof Error ? error.message : "Failed to approve"
      );
    } finally {
      setIsApproving(false);
    }
  };

  // Handle reject DRep
  const handleRejectDrep = async () => {
    if (!jwtToken || !rejectingDrep || !rejectRationale.trim()) return;

    setIsRejecting(true);
    setRejectError(null);
    try {
      await rejectDrep(jwtToken, rejectingDrep.drepId, {
        rationale: rejectRationale.trim(),
      });
      setShowRejectDialog(false);
      setRejectingDrep(null);
      setRejectRationale("");
      // Refresh the list
      const status = adminFilter === "ALL" ? undefined : adminFilter;
      const response = await listDrepRegistrations(jwtToken, status);
      if (response.success) {
        setAdminRegistrations(response.data);
      }
    } catch (error) {
      setRejectError(
        error instanceof Error ? error.message : "Failed to reject"
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle sign out - disconnect wallet and clear auth state
  const handleSignOut = useCallback(() => {
    disconnect();
    signOut();
    setApiKey(null);
    setIsAdmin(false);
  }, [disconnect, signOut]);

  // Register new DRep
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwtToken) {
      setRegisterError("Please connect your wallet and sign in first.");
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(false);

    try {
      const response = await registerDrep(jwtToken, {
        drepId: registerDrepId,
        discordGuildId: registerDiscordGuildId,
        drepName: registerDrepName || undefined,
        contactEmail: registerEmail || undefined,
      });

      if (response.success) {
        setRegisterSuccess(true);
        setRegisterDrepId("");
        setRegisterDiscordGuildId("");
        setRegisterDrepName("");
        setRegisterEmail("");
        // Update auth context with the new registration
        updateDrepRegistration({
          id: response.data.id,
          drepId: response.data.drepId,
          drepName: response.data.drepName,
          status: response.data.status as "PENDING" | "APPROVED" | "REJECTED",
        });
      }
    } catch (error) {
      setRegisterError(
        error instanceof Error ? error.message : "Registration failed"
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // Load API key
  const handleLoadApiKey = async () => {
    if (!jwtToken) return;

    setIsLoadingApiKey(true);
    setApiKeyError(null);

    try {
      const response = await getApiKey(jwtToken);

      if (response.success) {
        setApiKey(response.data.apiKey);
      }
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to load API key"
      );
    } finally {
      setIsLoadingApiKey(false);
    }
  };

  // Reset API key
  const handleResetApiKey = async () => {
    if (!jwtToken) return;

    setIsResettingApiKey(true);
    setApiKeyError(null);

    try {
      const response = await resetApiKey(jwtToken);

      if (response.success) {
        setApiKey(response.data.apiKey);
        setShowResetDialog(false);
      }
    } catch (error) {
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to reset API key"
      );
    } finally {
      setIsResettingApiKey(false);
    }
  };

  // Copy API key to clipboard
  const handleCopyApiKey = async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (showApiKey) return key;
    return key.substring(0, 12) + "..." + key.substring(key.length - 8);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Check className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Head>
        <title>DRep Registration - Cardano Governance</title>
        <meta
          name="description"
          content="Register and manage your DRep Discord bot connection"
        />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              DRep Delegator Feedback Integration
            </h1>
            <p className="text-muted-foreground">
              Register your DRep to enable Discord bot integration for delegator
              sentiment collection.
            </p>
          </div>

          <div className="space-y-6">
            {/* Loading State - show when authenticating */}
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
            {isAuthenticated && jwtToken && (
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Connected:</span>
                  <code className="text-xs bg-background px-2 py-0.5 rounded">
                    {walletAddress?.substring(0, 12)}...
                    {walletAddress?.substring(walletAddress.length - 8)}
                  </code>
                  {isAdmin && (
                    <Badge className="ml-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            )}

            {/* Admin Panel */}
            {isAdmin && jwtToken && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Admin Panel
                  </CardTitle>
                  <CardDescription>
                    Manage DRep registration requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filter buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(
                      (status) => (
                        <Button
                          key={status}
                          variant={
                            adminFilter === status ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setAdminFilter(status)}
                        >
                          {status === "PENDING" && (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {status === "APPROVED" && (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {status === "REJECTED" && (
                            <Ban className="w-3 h-3 mr-1" />
                          )}
                          {status}
                        </Button>
                      )
                    )}
                  </div>

                  {/* Error message */}
                  {adminError && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                      <AlertCircle className="w-4 h-4" />
                      {adminError}
                    </div>
                  )}

                  {/* Loading state */}
                  {isLoadingAdmin ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : adminRegistrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No{" "}
                      {adminFilter === "ALL" ? "" : adminFilter.toLowerCase()}{" "}
                      registrations found
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminRegistrations.map((reg) => (
                        <div
                          key={reg.id}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {reg.drepName || "Unnamed DRep"}
                                </span>
                                {getStatusBadge(reg.status)}
                              </div>
                              <code className="text-xs text-muted-foreground">
                                {reg.drepId}
                              </code>
                            </div>
                            <div className="flex gap-2">
                              {(reg.status === "PENDING" ||
                                reg.status === "REJECTED") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                                  onClick={() => {
                                    setApprovingDrep(reg);
                                    setShowApproveDialog(true);
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {(reg.status === "PENDING" ||
                                reg.status === "APPROVED") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                                  onClick={() => {
                                    setRejectingDrep(reg);
                                    setShowRejectDialog(true);
                                  }}
                                >
                                  <Ban className="w-4 h-4 mr-1" />
                                  {reg.status === "APPROVED"
                                    ? "Revoke"
                                    : "Reject"}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {reg.discordGuildId && (
                              <div>
                                <span className="text-muted-foreground">
                                  Discord Server:{" "}
                                </span>
                                <code className="text-xs">{reg.discordGuildId}</code>
                              </div>
                            )}
                            {reg.contactEmail && (
                              <div>
                                <span className="text-muted-foreground">
                                  Email:{" "}
                                </span>
                                {reg.contactEmail}
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">
                                Created:{" "}
                              </span>
                              {new Date(reg.createdAt).toLocaleDateString()}
                            </div>
                            {reg.reviewedAt && (
                              <div>
                                <span className="text-muted-foreground">
                                  Reviewed:{" "}
                                </span>
                                {new Date(reg.reviewedAt).toLocaleDateString()}
                              </div>
                            )}
                            {reg.rationale && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">
                                  Rationale:{" "}
                                </span>
                                {reg.rationale}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Registration Status / Management Section */}
            {jwtToken && drepRegistration ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Your DRep Registration</CardTitle>
                    {getStatusBadge(drepRegistration.status)}
                  </div>
                  <CardDescription>
                    DRep ID:{" "}
                    <span className="font-mono">{drepRegistration.drepId}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {drepRegistration.drepName && (
                    <div>
                      <Label className="text-muted-foreground">
                        Display Name
                      </Label>
                      <p className="font-medium">{drepRegistration.drepName}</p>
                    </div>
                  )}

                  {drepRegistration.status === "PENDING" && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-400">
                            Awaiting Approval
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Your registration is pending admin review.
                            You&apos;ll receive your API key once approved.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {drepRegistration.status === "REJECTED" && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-400">
                            Registration Rejected
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Please contact support for more information.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {drepRegistration.status === "APPROVED" && (
                    <div className="space-y-4">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-400">
                              Registration Approved
                            </p>
                            <p className="text-sm text-muted-foreground">
                              You can now use your API key to configure your
                              Discord bot.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* API Key Section */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>API Key</Label>
                          {!apiKey && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleLoadApiKey}
                              disabled={isLoadingApiKey}
                            >
                              {isLoadingApiKey ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Show API Key"
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The API Key is used for authorized data injection to
                          this governance platform for delegator sentiment
                          display purpose.
                        </p>

                        {apiKey && (
                          <>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm break-all">
                                {maskApiKey(apiKey)}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setShowApiKey(!showApiKey)}
                                title={showApiKey ? "Hide" : "Show"}
                              >
                                {showApiKey ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleCopyApiKey}
                                title="Copy"
                              >
                                {copied ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowResetDialog(true)}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reset API Key
                              </Button>
                            </div>
                          </>
                        )}

                        {apiKeyError && (
                          <p className="text-destructive text-sm">
                            {apiKeyError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* New Registration Section */}
            <Card className="relative">
              <CardHeader>
                <CardTitle>New DRep Registration</CardTitle>
                <CardDescription>
                  Register as a new DRep to get access to the Discord bot
                  integration. Registration requires admin approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Overlay when not authenticated */}
                {!isAuthenticated && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                    <div className="text-center p-4">
                      <p className="text-muted-foreground mb-3">
                        Connect your wallet to manage your DRep registration for
                        delegator sentiment display.
                      </p>
                      <ConnectWalletButton />
                    </div>
                  </div>
                )}
                {registerSuccess ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-400">
                          Registration Submitted
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Your registration has been submitted and is pending
                          admin approval.
                          {jwtToken
                            ? " You can claim this registration once approved."
                            : " Connect your wallet and claim it after signing in."}
                        </p>
                        <Button
                          variant="link"
                          className="px-0 h-auto"
                          onClick={() => setRegisterSuccess(false)}
                        >
                          Register another DRep
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="registerDrepId">DRep ID *</Label>
                      <Input
                        id="registerDrepId"
                        value={registerDrepId}
                        onChange={(e) => setRegisterDrepId(e.target.value)}
                        placeholder="drep1..."
                        required
                        disabled={!isAuthenticated}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your on-chain DRep ID in CIP-129 format.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerDiscordGuildId">
                        Discord Server ID *
                      </Label>
                      <Input
                        id="registerDiscordGuildId"
                        value={registerDiscordGuildId}
                        onChange={(e) => setRegisterDiscordGuildId(e.target.value)}
                        placeholder="123456789012345678"
                        required
                        disabled={!isAuthenticated}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your Discord server ID where the bot will be deployed.
                        Right-click your server name and select &quot;Copy Server
                        ID&quot; (requires Developer Mode enabled in Discord
                        settings).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerDrepName">
                        Display Name (Optional)
                      </Label>
                      <Input
                        id="registerDrepName"
                        value={registerDrepName}
                        onChange={(e) => setRegisterDrepName(e.target.value)}
                        placeholder="My DRep"
                        disabled={!isAuthenticated}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerEmail">
                        Contact Email (Optional)
                      </Label>
                      <Input
                        id="registerEmail"
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="drep@example.com"
                        disabled={!isAuthenticated}
                      />
                      <p className="text-xs text-muted-foreground">
                        For admin communication only. Not shared publicly.
                      </p>
                    </div>
                    {registerError && (
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {registerError}
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={
                        !isAuthenticated ||
                        isRegistering ||
                        !registerDrepId ||
                        !registerDiscordGuildId
                      }
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        "Submit Registration"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reset API Key Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset your API key? This action cannot be
              undone. Your Discord bot will need to be updated with the new key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetApiKey}
              disabled={isResettingApiKey}
            >
              {isResettingApiKey ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset API Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve DRep Dialog */}
      <Dialog
        open={showApproveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowApproveDialog(false);
            setApprovingDrep(null);
            setApproveRationale("");
            setApproveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve DRep Registration</DialogTitle>
            <DialogDescription>
              Approve the registration for{" "}
              <span className="font-medium text-foreground">
                {approvingDrep?.drepName || approvingDrep?.drepId}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approveRationale">Rationale (Optional)</Label>
              <Textarea
                id="approveRationale"
                value={approveRationale}
                onChange={(e) => setApproveRationale(e.target.value)}
                placeholder="Enter rationale for approval"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional notes about this approval decision.
              </p>
            </div>
            {approveError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {approveError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveDrep}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Registration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject DRep Dialog */}
      <Dialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRejectDialog(false);
            setRejectingDrep(null);
            setRejectRationale("");
            setRejectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject DRep Registration</DialogTitle>
            <DialogDescription>
              Reject the registration for{" "}
              <span className="font-medium text-foreground">
                {rejectingDrep?.drepName || rejectingDrep?.drepId}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectRationale">Rationale *</Label>
              <Textarea
                id="rejectRationale"
                value={rejectRationale}
                onChange={(e) => setRejectRationale(e.target.value)}
                placeholder="Enter rationale for rejection"
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                This rationale will be recorded and may be shared with the
                applicant.
              </p>
            </div>
            {rejectError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {rejectError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectDrep}
              disabled={isRejecting || !rejectRationale.trim()}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  Reject Registration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
