import { useState } from "react";
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
} from "lucide-react";

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

interface DelegatorSentimentData {
  proposalId: string;
  drepId: string;
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

// Mock data for demonstration
const MOCK_SENTIMENT_DATA: DelegatorSentimentData = {
  proposalId: "gov_action123",
  drepId: "drep1qg...",
  summary: {
    yesCount: 45,
    noCount: 12,
    abstainCount: 8,
    totalVotes: 65,
    yesPercent: 69.2,
    noPercent: 18.5,
    abstainPercent: 12.3,
  },
  votes: [
    {
      id: "1",
      discordUserId: "123456789",
      discordUsername: "alice_cardano",
      stakeAddress: "stake1u8pcjgmx7962w6hey5hhsd502araxp26kdtgagakhaqtq8squng76",
      liveStake: "125000000000", // 125,000 ADA
      sentiment: "YES",
      comment: "I support this proposal because it aligns with the long-term vision of Cardano governance. The treasury allocation seems reasonable.",
      createdAt: "2024-12-09T10:30:00Z",
    },
    {
      id: "2",
      discordUserId: "234567890",
      discordUsername: "bob_delegator",
      stakeAddress: "stake1u9a3t4rgddm4expj0ucyxkxqxkxjjxjx9ctgahgahgahgahqxy57n6",
      liveStake: "85000000000", // 85,000 ADA
      sentiment: "YES",
      createdAt: "2024-12-09T11:15:00Z",
    },
    {
      id: "3",
      discordUserId: "345678901",
      discordUsername: "carol_stake",
      stakeAddress: "stake1uxpdrerp8n8fevdnvf5f8xw8j9k8w8xn8w8xn8w8xn8w8xqcvd0zz",
      liveStake: "250000000000", // 250,000 ADA
      sentiment: "NO",
      comment: "I think the requested amount is too high. Would support a smaller allocation.",
      createdAt: "2024-12-09T12:00:00Z",
    },
    {
      id: "4",
      discordUserId: "456789012",
      discordUsername: "dave_hodl",
      stakeAddress: "stake1u8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xqpnxm8r",
      liveStake: "45000000000", // 45,000 ADA
      sentiment: "ABSTAIN",
      comment: "Need more information before I can make a decision.",
      createdAt: "2024-12-09T13:30:00Z",
    },
    {
      id: "5",
      discordUserId: "567890123",
      discordUsername: "eve_governance",
      stakeAddress: "stake1uy8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xqr9f2h4",
      liveStake: "180000000000", // 180,000 ADA
      sentiment: "YES",
      comment: "Great initiative! This will help bootstrap more development on Cardano.",
      createdAt: "2024-12-09T14:45:00Z",
    },
    {
      id: "6",
      discordUserId: "678901234",
      discordUsername: "frank_pool",
      stakeAddress: "stake1uz9w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xn8w8xqhvw3k7",
      liveStake: "320000000000", // 320,000 ADA
      sentiment: "NO",
      comment: "The timeline seems unrealistic. I'd vote yes if they extended it by 3 months.",
      createdAt: "2024-12-09T15:20:00Z",
    },
  ],
};

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

export function DelegatorSentiment({ proposalId }: DelegatorSentimentProps) {
  const { connected, wallet } = useWallet();
  const [isExpanded, setIsExpanded] = useState(false);
  const [drepId, setDrepId] = useState<string | null>(null);
  const [isLoadingDrep, setIsLoadingDrep] = useState(false);

  // In real implementation, this would fetch from API
  // For now, use mock data
  const sentimentData = MOCK_SENTIMENT_DATA;

  // Get DRep ID when wallet is connected
  // In real implementation, uncomment this:
  // useEffect(() => {
  //   async function getDrepId() {
  //     if (connected && wallet) {
  //       setIsLoadingDrep(true);
  //       try {
  //         const dRep = await wallet.getDRep();
  //         if (dRep?.dRepIDCip105) {
  //           setDrepId(dRep.dRepIDCip105);
  //         }
  //       } catch (err) {
  //         console.error("Failed to get DRep ID:", err);
  //       } finally {
  //         setIsLoadingDrep(false);
  //       }
  //     } else {
  //       setDrepId(null);
  //     }
  //   }
  //   getDrepId();
  // }, [connected, wallet]);

  // For demo purposes, simulate DRep connection when wallet is connected
  const isDrep = connected; // In real app: drepId !== null

  // If not connected as DRep, show connect prompt
  if (!isDrep) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Delegator Sentiment</h3>
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

  const { summary, votes } = sentimentData;
  const displayedVotes = isExpanded ? votes : votes.slice(0, 3);

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Delegator Sentiment</h3>
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
                      <span className="font-medium">{vote.discordUsername}</span>
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
                  <div className="text-xs text-muted-foreground">Live Stake</div>
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
