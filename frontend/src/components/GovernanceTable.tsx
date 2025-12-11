import { useState } from "react";
import { useRouter } from "next/router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setTypeFilter } from "@/store/governanceSlice";
import { Search } from "lucide-react";
import { VoteButtons } from "@/components/governance/VoteButtons";
import type {
  GovernanceAction,
  GovernanceActionType,
} from "@/types/governance";

/**
 * Parse proposal hash to extract txHash and certIndex
 */
function parseProposalHash(
  hash: string
): { txHash: string; certIndex: number } | null {
  if (!hash) return null;

  // Handle txHash:certIndex format (API format)
  if (hash.includes(":")) {
    const [txHash, certIndexStr] = hash.split(":");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  // Handle txHash#certIndex format (alternative format)
  if (hash.includes("#")) {
    const [txHash, certIndexStr] = hash.split("#");
    const certIndex = parseInt(certIndexStr, 10);
    if (txHash && !isNaN(certIndex)) {
      return { txHash, certIndex };
    }
  }

  return null;
}

function formatHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-6)}`;
}

/**
 * Legacy governance actions with special voting rules (before gov_action1js2s9v92zpxg2rge0y3jt9zy626he2m67x9kx9phw4r942kvsn6sqfym0d7)
 * These have hardcoded exceptions that don't follow the standard type-based rules
 */
const LEGACY_NON_APPLICABLE_DREP_ACTIONS = [
  "gov_action1k2jertppnnndejjcglszfqq4yzw8evzrd2nt66rr6rqlz54xp0zsq05ecsn",
  "gov_action1286ft23r7jem825s4l0y5rn8sgam0tz2ce04l7a38qmnhp3l9a6qqn850dw",
  "gov_action1pvv5wmjqhwa4u85vu9f4ydmzu2mgt8n7et967ph2urhx53r70xusqnmm525", // Hard Fork - DRep not applicable
];

const LEGACY_NON_APPLICABLE_SPO_ACTIONS = [
  "gov_action1k2jertppnnndejjcglszfqq4yzw8evzrd2nt66rr6rqlz54xp0zsq05ecsn",
  "gov_action1286ft23r7jem825s4l0y5rn8sgam0tz2ce04l7a38qmnhp3l9a6qqn850dw",
];

const LEGACY_NON_APPLICABLE_CC_ACTIONS: string[] = [];

/**
 * Governance action types where CC doesn't vote (threshold is null)
 * Based on VOTING_THRESHOLDS in proposalMapper.ts
 */
const CC_NOT_APPLICABLE_TYPES = ["No Confidence", "Update Committee"];

/**
 * Governance action types where SPO doesn't vote (threshold is null)
 * Based on VOTING_THRESHOLDS in proposalMapper.ts
 */
const SPO_NOT_APPLICABLE_TYPES = [
  "New Constitution",
  "Protocol Parameter Change",
  "Treasury Withdrawals",
];

function isLegacyAction(hash: string): boolean {
  const legacyActions = [
    ...LEGACY_NON_APPLICABLE_DREP_ACTIONS,
    ...LEGACY_NON_APPLICABLE_SPO_ACTIONS,
    ...LEGACY_NON_APPLICABLE_CC_ACTIONS,
  ];
  return legacyActions.some(
    (actionId) => hash === actionId || hash.includes(actionId)
  );
}

function isCcNotApplicable(action: GovernanceAction): boolean {
  // Check legacy exceptions first
  if (
    LEGACY_NON_APPLICABLE_CC_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  // For non-legacy actions, use type-based rules
  if (!isLegacyAction(action.hash)) {
    return CC_NOT_APPLICABLE_TYPES.includes(action.type);
  }
  return false;
}

function isDrepNotApplicable(action: GovernanceAction): boolean {
  // Check legacy exceptions first
  if (
    LEGACY_NON_APPLICABLE_DREP_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  // DRep always votes for all governance action types (no null threshold)
  return false;
}

function isSpoNotApplicable(action: GovernanceAction): boolean {
  // Check legacy exceptions first
  if (
    LEGACY_NON_APPLICABLE_SPO_ACTIONS.some(
      (actionId) => action.hash === actionId || action.hash.includes(actionId)
    )
  ) {
    return true;
  }
  // For non-legacy actions, use type-based rules
  if (!isLegacyAction(action.hash)) {
    return SPO_NOT_APPLICABLE_TYPES.includes(action.type);
  }
  return false;
}

function getStatusColor(status: GovernanceAction["status"]): string {
  switch (status) {
    case "Active":
      return "bg-success/20 text-success border-success/30";
    case "Ratified":
      return "bg-primary/20 text-primary border-primary/30";
    case "Enacted":
      return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    case "Expired":
      return "bg-amber-500/20 text-amber-500 border-amber-500/30";
    case "Closed":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function GovernanceTable() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const actions = useAppSelector((state) => state.governance.actions);
  const currentFilter = useAppSelector(
    (state) => state.governance.filters.type
  );

  const filteredActions = actions.filter((action) => {
    // Filter by type
    const matchesType =
      currentFilter === "All" || action.type === currentFilter;

    // Filter by search query (title)
    const matchesSearch =
      searchQuery === "" ||
      action.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const handleRowClick = (hash: string) => {
    router.push(`/governance/${hash}`);
  };

  const handleTabChange = (value: string) => {
    dispatch(setTypeFilter(value as GovernanceActionType));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Governance Actions</h2>
        <p className="text-muted-foreground">
          On-chain governance actions that are active, ratified, enacted,
          expired, or closed
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by proposal title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs
        value={currentFilter}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger
            value="All"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="Info Action"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Info Action
          </TabsTrigger>
          <TabsTrigger
            value="Treasury Withdrawals"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Treasury Withdrawals
          </TabsTrigger>
          <TabsTrigger
            value="New Constitution"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            New Constitution
          </TabsTrigger>
          <TabsTrigger
            value="Hard Fork Initiation"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Hard Fork Initiation
          </TabsTrigger>
          <TabsTrigger
            value="Protocol Parameter Change"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Protocol Parameter Change
          </TabsTrigger>
          <TabsTrigger
            value="No Confidence"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            No Confidence
          </TabsTrigger>
          <TabsTrigger
            value="Update Committee"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Update Committee
          </TabsTrigger>
        </TabsList>

        <TabsContent value={currentFilter} className="mt-6 space-y-4">
          {filteredActions.length === 0 ? (
            <Card className="p-12">
              <p className="text-center text-muted-foreground">
                No governance actions found
              </p>
            </Card>
          ) : (
            filteredActions.map((action) => (
              <Card
                key={action.hash}
                className="p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer"
                onClick={() => handleRowClick(action.hash)}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Main Info - 4 columns */}
                  <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={getStatusColor(action.status)}
                      >
                        {action.status}
                      </Badge>
                      <Badge variant="outline" className="bg-secondary/50">
                        {action.type}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{action.title}</h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatHash(action.hash)}
                    </p>
                  </div>

                  {/* CC Votes - 2 columns */}
                  <div
                    className={`lg:col-span-2 space-y-2 ${
                      isCcNotApplicable(action) ? "opacity-30 blur-[1px]" : ""
                    }`}
                  >
                    {action.ccYesPercent !== undefined ? (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">
                          CC Votes
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-success">
                              Yes: {action.ccYesPercent.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">
                              ({action.ccYesCount || 0})
                            </span>
                          </div>
                          <Progress
                            value={action.ccYesPercent}
                            className="h-2 bg-secondary"
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            No: {action.ccNoPercent?.toFixed(1) || "0"}%
                          </span>
                          <span>({action.ccNoCount || 0})</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">
                          CC Votes
                        </div>
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          N/A
                        </div>
                      </>
                    )}
                  </div>

                  {/* DRep Votes - 2 columns */}
                  <div
                    className={`lg:col-span-2 space-y-2 ${
                      isDrepNotApplicable(action) ? "opacity-30 blur-[1px]" : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-muted-foreground">
                      DRep Votes
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-success">
                          Yes: {action.drepYesPercent.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground">
                          {action.drepYesAda} ₳
                        </span>
                      </div>
                      <Progress
                        value={action.drepYesPercent}
                        className="h-2 bg-secondary"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>No: {action.drepNoPercent.toFixed(1)}%</span>
                      <span>{action.drepNoAda} ₳</span>
                    </div>
                  </div>

                  {/* SPO Votes - 2 columns */}
                  <div
                    className={`lg:col-span-2 space-y-2 ${
                      isSpoNotApplicable(action) ? "opacity-30 blur-[1px]" : ""
                    }`}
                  >
                    {action.spoYesPercent !== undefined ? (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">
                          SPO Votes
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-success">
                              Yes: {action.spoYesPercent.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">
                              {action.spoYesAda || "0"} ₳
                            </span>
                          </div>
                          <Progress
                            value={action.spoYesPercent}
                            className="h-2 bg-secondary"
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            No: {action.spoNoPercent?.toFixed(1) || "0"}%
                          </span>
                          <span>{action.spoNoAda || "0"} ₳</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">
                          SPO Votes
                        </div>
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          N/A
                        </div>
                      </>
                    )}
                  </div>

                  {/* Vote Counts - 2 columns */}
                  <div className="lg:col-span-2 flex flex-col justify-center text-right lg:text-center space-y-1">
                    <div className="text-sm">
                      <span className="text-success font-semibold">
                        Yes: {action.totalYes}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-destructive font-semibold">
                        No: {action.totalNo}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Abstain: {action.totalAbstain}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground space-x-4">
                    <span>Submission: Epoch {action.submissionEpoch}</span>
                    <span>Expiry: Epoch {action.expiryEpoch}</span>
                  </div>

                  {/* Voting buttons for active proposals */}
                  {action.status === "Active" &&
                    (() => {
                      const parsed = parseProposalHash(action.hash);
                      if (parsed) {
                        return (
                          <VoteButtons
                            txHash={parsed.txHash}
                            certIndex={parsed.certIndex}
                            proposalTitle={action.title}
                            status={action.status}
                            compact
                          />
                        );
                      }
                      return null;
                    })()}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
