/**
 * Vote info for DRep and SPO voters (ADA-based voting power)
 */
export interface GovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesAda: string;
  noAda: string;
  abstainAda: string;
}

/**
 * Vote info for Constitutional Committee (count-based)
 */
export interface CCGovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

/**
 * Main governance action interface
 * Matches the API response from /overview/proposals
 */
export interface GovernanceAction {
  // Identifiers
  hash: string; // Used for routing - typically proposalId
  proposalId?: string; // Cardano governance action ID (txHash:certIndex)
  txHash?: string; // Transaction hash

  // Content
  title: string;
  type: string; // Governance action type label
  status: "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";
  constitutionality: string;

  // DRep voting data (flattened for easy access)
  drepYesPercent: number;
  drepNoPercent: number;
  drepAbstainPercent?: number;
  drepYesAda: string;
  drepNoAda: string;
  drepAbstainAda?: string;

  // SPO voting data (optional - not all actions require SPO votes)
  spoYesPercent?: number;
  spoNoPercent?: number;
  spoAbstainPercent?: number;
  spoYesAda?: string;
  spoNoAda?: string;
  spoAbstainAda?: string;

  // CC voting data (optional - not all actions require CC votes)
  ccYesPercent?: number;
  ccNoPercent?: number;
  ccAbstainPercent?: number;
  ccYesCount?: number;
  ccNoCount?: number;
  ccAbstainCount?: number;

  // Vote totals (counts across all voter types)
  totalYes: number;
  totalNo: number;
  totalAbstain: number;

  // Epoch information
  submissionEpoch: number;
  expiryEpoch: number;

  // Raw API vote info objects (for advanced use)
  drep?: GovernanceActionVoteInfo;
  spo?: GovernanceActionVoteInfo;
  cc?: CCGovernanceActionVoteInfo;
}

/**
 * Individual vote record
 * Matches the API response for vote details
 */
export interface VoteRecord {
  voterType?: "DRep" | "SPO" | "CC";
  voterId?: string;
  voterName?: string;
  // Legacy fields for backwards compatibility
  drepId: string;
  drepName: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower: string;
  votingPowerAda: number;
  anchorUrl?: string;
  anchorHash?: string;
  votedAt: string;
}

/**
 * Detailed governance action with full description and vote records
 * Matches the API response from /proposal/:id
 */
export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  votes?: VoteRecord[]; // DRep and SPO votes
  ccVotes?: VoteRecord[]; // Constitutional Committee votes
}

/**
 * Governance action type filter options
 */
export type GovernanceActionType =
  | "All"
  | "Info Action"
  | "Treasury Withdrawals"
  | "New Constitution"
  | "Hard Fork Initiation"
  | "Protocol Parameter Change"
  | "No Confidence"
  | "Update Committee";

/**
 * Vote type filter options
 */
export type VoteType = "All" | "Yes" | "No" | "Abstain";

/**
 * Overview summary data from API
 * Matches the API response from /overview
 */
export interface OverviewSummary {
  year: number;
  currentValue: number; // Active proposals
  targetValue: number; // Total proposals
  totalProposals: number;
  activeProposals: number;
  ratifiedProposals: number;
  enactedProposals: number;
  expiredProposals: number;
  closedProposals: number;
}

/**
 * NCL (Network Consensus Ledger) data for stats display
 * @deprecated Use OverviewSummary instead
 */
export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}
