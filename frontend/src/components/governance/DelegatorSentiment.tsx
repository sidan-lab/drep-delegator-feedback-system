import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@meshsdk/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConnectWalletButton } from "@/components/wallet";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  MessageSquare,
  Users,
  Wallet,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { fetchSentiment, fetchSentimentReactions } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import type { SentimentResponse, SentimentReaction } from "@/types/governance";

interface DelegatorVote {
  id: string;
  discordUserId: string;
  discordUsername: string;
  stakeAddress: string;
  liveStake: string; // in lovelace
  sentiment: "YES" | "NO" | "ABSTAIN";
  comment?: string;
  createdAt: string;
}

interface SentimentDisplayData {
  summary: {
    yesCount: number;
    noCount: number;
    abstainCount: number;
    totalVotes: number;
    yesPercent: number;
    noPercent: number;
    abstainPercent: number;
  };
  votes: DelegatorVote[];
}

/**
 * Format lovelace to ADA with K/M suffix
 */
function formatStake(lovelace: string): string {
  const ada = parseInt(lovelace) / 1_000_000;
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(1)}K`;
  }
  return ada.toFixed(0);
}

/**
 * Format stake address for display (truncated)
 */
function formatStakeAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 12)}...${address.slice(-8)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get sentiment badge styling
 */
function getSentimentBadge(sentiment: "YES" | "NO" | "ABSTAIN") {
  switch (sentiment) {
    case "YES":
      return {
        className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        icon: ThumbsUp,
        label: "Yes",
      };
    case "NO":
      return {
        className: "bg-red-500/20 text-red-400 border-red-500/30",
        icon: ThumbsDown,
        label: "No",
      };
    case "ABSTAIN":
      return {
        className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        icon: MinusCircle,
        label: "Abstain",
      };
  }
}

interface DelegatorSentimentProps {
  proposalId: string;
}

/**
 * Transform API response to display format
 */
function transformSentimentData(
  sentimentResponse: SentimentResponse,
  reactions: SentimentReaction[]
): SentimentDisplayData {
  const { totals } = sentimentResponse;
  const totalVotes = totals.totalReactions;

  return {
    summary: {
      yesCount: totals.yesCount,
      noCount: totals.noCount,
      abstainCount: totals.abstainCount,
      totalVotes,
      yesPercent: totalVotes > 0 ? (totals.yesCount / totalVotes) * 100 : 0,
      noPercent: totalVotes > 0 ? (totals.noCount / totalVotes) * 100 : 0,
      abstainPercent:
        totalVotes > 0 ? (totals.abstainCount / totalVotes) * 100 : 0,
    },
    votes: reactions.map((r) => ({
      id: r.id,
      discordUserId: r.discordUserId,
      discordUsername: r.discordUsername,
      stakeAddress: r.stakeAddress || "",
      liveStake: r.liveStake || "0",
      sentiment: r.sentiment,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
  };
}

export function DelegatorSentiment({ proposalId }: DelegatorSentimentProps) {
  const { connected, wallet } = useWallet();
  const { isAuthenticated, jwtToken } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drepId, setDrepId] = useState<string | null>(null);
  const [sentimentData, setSentimentData] =
    useState<SentimentDisplayData | null>(null);

  // Track if we've already loaded data for this proposal to prevent duplicate fetches
  const loadedProposalRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // Fetch DRep ID from connected wallet
  // Note: Wallet returns CIP-105 format, backend will resolve to CIP-129
  const fetchDrepId = useCallback(async () => {
    if (!wallet) return null;

    try {
      const dRep = await wallet.getDRep();
      if (dRep?.dRepIDCip105) {
        return dRep.dRepIDCip105;
      }
      return null;
    } catch (err) {
      console.error("Failed to get DRep ID:", err);
      return null;
    }
  }, [wallet]);

  // Fetch sentiment data when wallet is connected, authenticated, and DRep ID is available
  useEffect(() => {
    const loadSentimentData = async () => {
      // Skip if not ready
      if (!connected || !wallet || !isAuthenticated || !jwtToken) {
        setSentimentData(null);
        setDrepId(null);
        loadedProposalRef.current = null;
        return;
      }

      // Skip if already loading or already loaded for this proposal
      if (isLoadingRef.current) {
        return;
      }
      if (loadedProposalRef.current === proposalId) {
        return;
      }

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // Get DRep ID from wallet
        const walletDrepId = await fetchDrepId();

        if (!walletDrepId) {
          setError("Could not get DRep ID from wallet. Please ensure your wallet is registered as a DRep.");
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }

        setDrepId(walletDrepId);

        // Fetch sentiment summary and reactions in parallel (with JWT auth)
        const [summaryResponse, reactionsResponse] = await Promise.all([
          fetchSentiment(proposalId, walletDrepId, jwtToken),
          fetchSentimentReactions(proposalId, walletDrepId, jwtToken),
        ]);

        if (!summaryResponse) {
          // No sentiment data yet - show empty state
          setSentimentData({
            summary: {
              yesCount: 0,
              noCount: 0,
              abstainCount: 0,
              totalVotes: 0,
              yesPercent: 0,
              noPercent: 0,
              abstainPercent: 0,
            },
            votes: [],
          });
        } else {
          const transformed = transformSentimentData(
            summaryResponse,
            reactionsResponse?.reactions || []
          );
          setSentimentData(transformed);
        }

        // Mark this proposal as loaded
        loadedProposalRef.current = proposalId;
      } catch (err) {
        console.error("Failed to load sentiment data:", err);
        setError("Failed to load delegator sentiment data.");
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadSentimentData();
  }, [connected, wallet, isAuthenticated, jwtToken, proposalId, fetchDrepId]);

  const isDrep = connected && isAuthenticated && drepId;

  // If not connected or not authenticated, show connect prompt
  if (!connected || !isAuthenticated) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <div className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-secondary">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Connect your DRep wallet to view your delegators&apos; sentiment
            </p>
            <p className="text-sm text-muted-foreground/70">
              Only DReps can view their own delegators&apos; feedback
            </p>
          </div>
          <ConnectWalletButton />
        </div>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <div className="flex items-center gap-3 text-destructive bg-destructive/10 p-4 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  // Not a DRep
  if (!isDrep || !sentimentData) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <div className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-secondary">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Your wallet is not registered as a DRep
            </p>
            <p className="text-sm text-muted-foreground/70">
              Only registered DReps can view delegator sentiment
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const { summary, votes } = sentimentData;
  const displayedVotes = isExpanded ? votes : votes.slice(0, 3);

  // Empty state - no votes yet
  if (summary.totalVotes === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <div className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-secondary">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground">
              No delegator feedback yet
            </p>
            <p className="text-sm text-muted-foreground/70">
              Your delegators haven&apos;t submitted any sentiment for this proposal
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your Delegator Sentiment</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {summary.totalVotes} delegators voted
        </Badge>
      </div>

      {/* Summary Section - Vote Distribution */}
      <div className="space-y-4 mb-6">
        {/* Yes */}
        <div>
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                Yes: {summary.yesPercent.toFixed(1)}%
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {summary.yesCount} votes
            </span>
          </div>
          <Progress
            value={summary.yesPercent}
            className="h-3 bg-secondary [&>div]:bg-emerald-500"
          />
        </div>

        {/* No */}
        <div>
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">
                No: {summary.noPercent.toFixed(1)}%
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {summary.noCount} votes
            </span>
          </div>
          <Progress
            value={summary.noPercent}
            className="h-3 bg-secondary [&>div]:bg-red-500"
          />
        </div>

        {/* Abstain */}
        <div>
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-400">
                Abstain: {summary.abstainPercent.toFixed(1)}%
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {summary.abstainCount} votes
            </span>
          </div>
          <Progress
            value={summary.abstainPercent}
            className="h-3 bg-secondary [&>div]:bg-gray-500"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-6" />

      {/* Individual Votes Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground">
          Individual Votes
        </h4>

        {displayedVotes.map((vote) => {
          const sentimentBadge = getSentimentBadge(vote.sentiment);
          const SentimentIcon = sentimentBadge.icon;

          return (
            <div
              key={vote.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3"
            >
              {/* Vote Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Discord Avatar Placeholder */}
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {vote.discordUsername.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {vote.discordUsername}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${sentimentBadge.className}`}
                      >
                        <SentimentIcon className="h-3 w-3 mr-1" />
                        {sentimentBadge.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{formatDate(vote.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-primary">
                    {formatStake(vote.liveStake)} ADA
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Live Stake
                  </div>
                </div>
              </div>

              {/* Stake Address */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Stake:</span>
                <code className="bg-secondary px-2 py-1 rounded font-mono">
                  {formatStakeAddress(vote.stakeAddress)}
                </code>
                <a
                  href={`https://cardanoscan.io/stakekey/${vote.stakeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Comment */}
              {vote.comment && (
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80">{vote.comment}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* Show More/Less Button */}
        {votes.length > 3 && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show All {votes.length} Votes
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
