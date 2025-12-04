export interface GovernanceAction {
  proposalId: string;
  txHash: string;
  title: string;
  type: string;
  status: "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";
  constitutionality: string;
  drep: GovernanceActionVoteInfo;
  spo?: GovernanceActionVoteInfo;
  cc?: CCGovernanceActionVoteInfo;
  totalYes: number;
  totalNo: number;
  totalAbstain: number;
  submissionEpoch: number;
  expiryEpoch: number;
}

export interface GovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesAda: string;
  noAda: string;
  abstainAda: string;
}

export interface CCGovernanceActionVoteInfo {
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

export interface VoteRecord {
  voterType: "DRep" | "SPO" | "CC";
  voterId: string;
  voterName?: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower?: string;
  votingPowerAda?: number;
  anchorUrl?: string;
  anchorHash?: string;
  votedAt: string;
}

export interface GovernanceActionDetail extends GovernanceAction {
  description?: string;
  rationale?: string;
  votes?: VoteRecord[];
  ccVotes?: VoteRecord[];
}

export type GovernanceActionType =
  | "All"
  | "Info Action"
  | "Treasury Withdrawals"
  | "New Constitution"
  | "Hard Fork Initiation"
  | "Protocol Parameter Change"
  | "No Confidence"
  | "Update Committee";
export type VoteType = "All" | "Yes" | "No" | "Abstain";

export interface NCLData {
  year: number;
  currentValue: number;
  targetValue: number;
}

export interface ProposalSummary {
  totalProposals: number;
  activeProposals: number;
  ratifiedProposals: number;
  enactedProposals: number;
  expiredProposals: number;
  closedProposals: number; // Only for INFO governance actions
}
