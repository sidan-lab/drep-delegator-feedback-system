import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VoteRecord } from "@/types/governance";
import { Search, ExternalLink, FileText } from "lucide-react";

interface VotingRecordsProps {
  votes: VoteRecord[];
  ccVotes?: VoteRecord[];
}

/**
 * Convert lovelace string to formatted ADA string
 * 1 ADA = 1,000,000 lovelace
 */
function lovelaceToAda(lovelace: string | number): string {
  const lovelaceNum =
    typeof lovelace === "string" ? Number(lovelace) : lovelace;
  if (isNaN(lovelaceNum) || lovelaceNum === 0) return "0";
  const adaValue = Math.round(lovelaceNum / 1_000_000);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(adaValue);
}

function getVoteBadgeClasses(vote: VoteRecord["vote"]): string {
  switch (vote) {
    case "Yes":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30";
    case "No":
      return "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30";
    case "Abstain":
      return "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getVoterTypeBadgeClasses(voterType: string): string {
  switch (voterType) {
    case "DRep":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "SPO":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "CC":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

/**
 * Extract readable text from a JSON object
 * Looks for common text fields and concatenates them
 */
function extractTextFromObject(obj: Record<string, unknown>): string {
  // Priority fields that typically contain the main rationale text
  const textFields = [
    "comment",
    "rationale",
    "reason",
    "motivation",
    "body",
    "text",
    "content",
    "description",
    "summary",
  ];

  for (const field of textFields) {
    if (obj[field] && typeof obj[field] === "string") {
      return obj[field] as string;
    }
  }

  // If no text field found, try to find any string value
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && value.length > 50) {
      return value;
    }
  }

  // Fallback: return a formatted representation
  return "Unable to extract rationale text from the source.";
}

/**
 * Convert IPFS URL to HTTP gateway URL
 * Handles ipfs:// protocol URLs and converts them to a public gateway
 */
function toFetchableUrl(url: string): string {
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return url;
}

/**
 * Convert URL to a viewable format for external links
 * For ipfs:// URLs, converts to gateway URL
 */
function toViewableUrl(url: string): string {
  return toFetchableUrl(url);
}

/**
 * Component to fetch and display rationale content from anchor URL
 */
function RationaleContent({ anchorUrl }: { anchorUrl: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRationale() {
      setIsLoading(true);
      setError(null);

      try {
        const fetchUrl = toFetchableUrl(anchorUrl);
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch rationale: ${response.status}`);
        }

        const rawText = await response.text();
        let text: string;

        // Try to parse as JSON first
        try {
          const json = JSON.parse(rawText);

          // Extract the rationale text from common JSON formats
          if (typeof json === "string") {
            text = json;
          } else if (json.body?.comment) {
            // CIP-100 format with nested comment
            text = json.body.comment;
          } else if (json.body) {
            text = typeof json.body === "string" ? json.body : extractTextFromObject(json.body);
          } else if (json.comment) {
            text = json.comment;
          } else if (json.rationale) {
            text = json.rationale;
          } else if (json.reason) {
            text = json.reason;
          } else if (json.motivation) {
            text = json.motivation;
          } else {
            // Try to extract any text-like field from the object
            text = extractTextFromObject(json);
          }
        } catch {
          // Not JSON, use raw text
          text = rawText;
        }

        // Clean up the text: convert \n to actual line breaks
        text = text.replace(/\\n/g, "\n");

        setContent(text);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load rationale"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchRationale();
  }, [anchorUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading rationale...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive py-4">
        <p className="font-medium">Unable to load rationale</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <p className="text-xs text-muted-foreground mt-2">
          You can try opening the link directly using the external link button.
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
      {content || "No rationale content available."}
    </div>
  );
}

export function VotingRecords({ votes, ccVotes = [] }: VotingRecordsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState<string>("all");
  const [voterTypeFilter, setVoterTypeFilter] = useState<string>("all");

  // Combine all votes into a single array
  const allVotes = [...votes, ...ccVotes];

  // Get unique voter types from the data
  const availableVoterTypes = Array.from(
    new Set(allVotes.map((v) => v.voterType).filter(Boolean))
  ) as string[];

  const filteredVotes = allVotes.filter((vote) => {
    const matchesSearch =
      searchQuery === "" ||
      vote.drepName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.drepId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.voterId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.voterName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVote =
      voteFilter === "all" || vote.vote.toLowerCase() === voteFilter;

    const matchesVoterType =
      voterTypeFilter === "all" || vote.voterType === voterTypeFilter;

    return matchesSearch && matchesVote && matchesVoterType;
  });

  const voteStats = {
    total: allVotes.length,
    yes: allVotes.filter((v) => v.vote === "Yes").length,
    no: allVotes.filter((v) => v.vote === "No").length,
    abstain: allVotes.filter((v) => v.vote === "Abstain").length,
  };

  // Get display name and ID for a vote record
  const getVoterDisplayName = (vote: VoteRecord): string => {
    return (
      vote.voterName ||
      vote.drepName ||
      vote.voterId ||
      vote.drepId ||
      "Unknown"
    );
  };

  const getVoterDisplayId = (vote: VoteRecord): string => {
    return vote.voterId || vote.drepId || "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Voting Records</h2>
        <p className="text-muted-foreground">
          Individual votes and their rationale
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.total}</div>
          <div className="text-sm text-muted-foreground">Total Votes</div>
        </Card>
        <Card className="p-4 border-success/30">
          <div className="text-2xl font-bold text-success">{voteStats.yes}</div>
          <div className="text-sm text-muted-foreground">Yes Votes</div>
        </Card>
        <Card className="p-4 border-destructive/30">
          <div className="text-2xl font-bold text-destructive">
            {voteStats.no}
          </div>
          <div className="text-sm text-muted-foreground">No Votes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.abstain}</div>
          <div className="text-sm text-muted-foreground">Abstain</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={voterTypeFilter} onValueChange={setVoterTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by voter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Voter Types</SelectItem>
              {availableVoterTypes.includes("DRep") && (
                <SelectItem value="DRep">DRep</SelectItem>
              )}
              {availableVoterTypes.includes("SPO") && (
                <SelectItem value="SPO">SPO</SelectItem>
              )}
              {availableVoterTypes.includes("CC") && (
                <SelectItem value="CC">CC</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={voteFilter} onValueChange={setVoteFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by vote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Votes</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="abstain">Abstain</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Voting Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vote</TableHead>
                <TableHead>Live Voting Power</TableHead>
                <TableHead>Voted At</TableHead>
                <TableHead className="text-right">Rationale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVotes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-12"
                  >
                    No voting records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVotes.map((vote, index) => {
                  const isCC = vote.voterType === "CC";
                  const voterName = getVoterDisplayName(vote);
                  const voterId = getVoterDisplayId(vote);

                  return (
                    <TableRow
                      key={`${voterId}-${index}`}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div>
                          <div className="font-semibold">{voterName}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {voterId.slice(0, 20)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVoterTypeBadgeClasses(
                            vote.voterType || ""
                          )}
                        >
                          {vote.voterType || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVoteBadgeClasses(vote.vote)}
                        >
                          {vote.vote}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!isCC ? (
                          <div className="font-semibold">
                            {lovelaceToAda(vote.votingPower)} ADA
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(vote.votedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {vote.anchorUrl ? (
                          <div className="flex items-center justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <FileText className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>
                                    Voting Rationale - {voterName}
                                  </DialogTitle>
                                  <DialogDescription>
                                    View the detailed reasoning for this vote
                                  </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                      <Badge
                                        variant="outline"
                                        className={getVoteBadgeClasses(
                                          vote.vote
                                        )}
                                      >
                                        {vote.vote}
                                      </Badge>
                                      <a
                                        href={toViewableUrl(vote.anchorUrl!)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-sm flex items-center gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Original Source
                                      </a>
                                    </div>
                                    <RationaleContent
                                      anchorUrl={vote.anchorUrl!}
                                    />
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                            <a
                              href={toViewableUrl(vote.anchorUrl!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No rationale
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
