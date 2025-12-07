import {
  Proposal as PrismaProposal,
  OnchainVote,
  GovernanceType,
  ProposalStatus,
  VoteType,
  VoterType,
  Drep,
  SPO,
  CC,
  Prisma,
} from "@prisma/client";
import {
  GovernanceAction,
  GovernanceActionDetail,
  GovernanceActionVoteInfo,
  CCGovernanceActionVoteInfo,
  VoteRecord,
} from "../models";

type VoteWithRelations = OnchainVote & {
  drep: Drep | null;
  spo: SPO | null;
  cc: CC | null;
};

export type ProposalWithVotes = PrismaProposal & {
  onchainVotes: VoteWithRelations[];
};

export const proposalWithVotesSelect = {
  id: true,
  proposalId: true,
  txHash: true,
  certIndex: true,
  title: true,
  description: true,
  rationale: true,
  governanceActionType: true,
  status: true,
  submissionEpoch: true,
  ratifiedEpoch: true,
  enactedEpoch: true,
  droppedEpoch: true,
  expiredEpoch: true,
  expirationEpoch: true,
  // DRep voting power fields
  drepTotalVotePower: true,
  drepActiveYesVotePower: true,
  drepActiveNoVotePower: true,
  drepActiveAbstainVotePower: true,
  drepAlwaysAbstainVotePower: true,
  drepAlwaysNoConfidenceVotePower: true,
  drepInactiveVotePower: true,
  // SPO voting power fields
  spoTotalVotePower: true,
  spoActiveYesVotePower: true,
  spoActiveNoVotePower: true,
  spoActiveAbstainVotePower: true,
  spoAlwaysAbstainVotePower: true,
  spoAlwaysNoConfidenceVotePower: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  onchainVotes: {
    include: {
      drep: true,
      spo: true,
      cc: true,
    },
  },
} satisfies Prisma.ProposalSelect;

interface AdaTally {
  yes: number;
  no: number;
  abstain: number;
  total: number;
}

interface CountTally extends AdaTally {}

const statusLabelMap: Record<ProposalStatus, GovernanceAction["status"]> = {
  ACTIVE: "Active",
  RATIFIED: "Ratified",
  ENACTED: "Enacted",
  EXPIRED: "Expired",
  CLOSED: "Closed",
};

/**
 * Maps database GovernanceType enum to full display labels
 */
const governanceTypeLabelMap: Record<GovernanceType, string> = {
  INFO_ACTION: "Info Action",
  TREASURY_WITHDRAWALS: "Treasury Withdrawals",
  NEW_CONSTITUTION: "New Constitution",
  HARD_FORK_INITIATION: "Hard Fork Initiation",
  PROTOCOL_PARAMETER_CHANGE: "Protocol Parameter Change",
  NO_CONFIDENCE: "No Confidence",
  UPDATE_COMMITTEE: "Update Committee",
};

const formatGovernanceType = (type?: GovernanceType | null): string => {
  if (!type) {
    return "Unknown";
  }
  return governanceTypeLabelMap[type] ?? "Unknown";
};

const formatStatus = (status: ProposalStatus) =>
  statusLabelMap[status] ?? "Active";

const percent = (value: number, total: number) =>
  total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));

/**
 * Gets voting power in lovelace from a vote (BigInt stored, returned as number for tallying)
 */
const getLovelaceValue = (vote: VoteWithRelations): number => {
  if (vote.votingPower !== null && vote.votingPower !== undefined) {
    return Number(vote.votingPower);
  }
  return 0;
};

/**
 * Tallies voting power in lovelace for each vote type
 */
const tallyLovelaceVotes = (votes: VoteWithRelations[]): AdaTally => {
  const totals: AdaTally = { yes: 0, no: 0, abstain: 0, total: 0 };

  for (const vote of votes) {
    const power = getLovelaceValue(vote);
    if (vote.vote === VoteType.YES) {
      totals.yes += power;
    } else if (vote.vote === VoteType.NO) {
      totals.no += power;
    } else {
      totals.abstain += power;
    }
  }

  totals.total = totals.yes + totals.no + totals.abstain;
  return totals;
};

const tallyCountVotes = (votes: VoteWithRelations[]): CountTally => {
  const totals: CountTally = { yes: 0, no: 0, abstain: 0, total: 0 };

  for (const vote of votes) {
    if (vote.vote === VoteType.YES) {
      totals.yes += 1;
    } else if (vote.vote === VoteType.NO) {
      totals.no += 1;
    } else {
      totals.abstain += 1;
    }
  }

  totals.total = totals.yes + totals.no + totals.abstain;
  return totals;
};

const combineCountTallies = (...counts: CountTally[]): CountTally =>
  counts.reduce(
    (acc, current) => ({
      yes: acc.yes + current.yes,
      no: acc.no + current.no,
      abstain: acc.abstain + current.abstain,
      total: acc.total + current.total,
    }),
    { yes: 0, no: 0, abstain: 0, total: 0 }
  );

/**
 * Helper to safely convert BigInt or number to number for calculations
 * Accepts both types for compatibility during schema migration
 */
const toNumber = (value: bigint | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

/**
 * Calculate DRep vote info using the new formula:
 * - Not Voted = Total - Yes - No - Abstain - AlwaysAbstain - AlwaysNoConfidence - Inactive
 * - Yes % = Yes / (Yes + No + AlwaysNoConfidence + NotVoted)
 * - No % = (No + AlwaysNoConfidence + NotVoted) / (Yes + No + AlwaysNoConfidence + NotVoted)
 *
 * All values from proposal are stored in lovelace (BigInt), returned as lovelace strings
 */
const buildDrepVoteInfo = (
  proposal: ProposalWithVotes
): GovernanceActionVoteInfo => {
  // Convert to number for calculations (values are in lovelace)
  const total = toNumber(proposal.drepTotalVotePower);
  const yes = toNumber(proposal.drepActiveYesVotePower);
  const no = toNumber(proposal.drepActiveNoVotePower);
  const abstain = toNumber(proposal.drepActiveAbstainVotePower);
  const alwaysAbstain = toNumber(proposal.drepAlwaysAbstainVotePower);
  const alwaysNoConfidence = toNumber(proposal.drepAlwaysNoConfidenceVotePower);
  const inactive = toNumber(proposal.drepInactiveVotePower);

  // Calculate "Not Voted" power
  const notVoted =
    total - yes - no - abstain - alwaysAbstain - alwaysNoConfidence - inactive;

  // Denominator for percentage calculation (excludes abstain and inactive)
  const denominator = yes + no + alwaysNoConfidence + Math.max(0, notVoted);

  // Calculate percentages
  const yesPercent = denominator > 0 ? (yes / denominator) * 100 : 0;
  const noPercent =
    denominator > 0
      ? ((no + alwaysNoConfidence + Math.max(0, notVoted)) / denominator) * 100
      : 0;
  const abstainPercent =
    total > 0 ? ((abstain + alwaysAbstain) / total) * 100 : 0;

  // Return lovelace values as strings
  return {
    yesPercent: Number(yesPercent.toFixed(2)),
    noPercent: Number(noPercent.toFixed(2)),
    abstainPercent: Number(abstainPercent.toFixed(2)),
    yesLovelace: Math.round(yes).toString(),
    noLovelace: Math.round(
      no + alwaysNoConfidence + Math.max(0, notVoted)
    ).toString(),
    abstainLovelace: Math.round(abstain + alwaysAbstain).toString(),
  };
};

/**
 * Calculate SPO vote info using the new formula:
 * - Not Voted = Total - Yes - No - Abstain
 * - Yes % = Yes / (Yes + No + NotVoted)
 * - No % = (No + NotVoted) / (Yes + No + NotVoted)
 *
 * All values from proposal are stored in lovelace (BigInt), returned as lovelace strings
 */
const buildSpoVoteInfo = (
  proposal: ProposalWithVotes
): GovernanceActionVoteInfo | undefined => {
  // If no SPO voting power data, return undefined
  if (
    proposal.spoTotalVotePower === null ||
    proposal.spoTotalVotePower === undefined
  ) {
    return undefined;
  }

  // Convert to number for calculations (values are in lovelace)
  const total = toNumber(proposal.spoTotalVotePower);
  const yes = toNumber(proposal.spoActiveYesVotePower);
  const no = toNumber(proposal.spoActiveNoVotePower);
  const abstain = toNumber(proposal.spoActiveAbstainVotePower);

  // Calculate "Not Voted" power
  const notVoted = total - yes - no - abstain;

  // Denominator for percentage calculation (excludes abstain)
  const denominator = yes + no + Math.max(0, notVoted);

  // Calculate percentages
  const yesPercent = denominator > 0 ? (yes / denominator) * 100 : 0;
  const noPercent =
    denominator > 0 ? ((no + Math.max(0, notVoted)) / denominator) * 100 : 0;
  const abstainPercent = total > 0 ? (abstain / total) * 100 : 0;

  // Return lovelace values as strings
  return {
    yesPercent: Number(yesPercent.toFixed(2)),
    noPercent: Number(noPercent.toFixed(2)),
    abstainPercent: Number(abstainPercent.toFixed(2)),
    yesLovelace: Math.round(yes).toString(),
    noLovelace: Math.round(no + Math.max(0, notVoted)).toString(),
    abstainLovelace: Math.round(abstain).toString(),
  };
};

/**
 * Build vote info from tally (values are already in lovelace)
 */
const buildVoteInfo = (tally: AdaTally): GovernanceActionVoteInfo => ({
  yesPercent: percent(tally.yes, tally.total),
  noPercent: percent(tally.no, tally.total),
  abstainPercent: percent(tally.abstain, tally.total),
  yesLovelace: Math.round(tally.yes).toString(),
  noLovelace: Math.round(tally.no).toString(),
  abstainLovelace: Math.round(tally.abstain).toString(),
});

const buildCcVoteInfo = (tally: CountTally): CCGovernanceActionVoteInfo => ({
  yesPercent: percent(tally.yes, tally.total),
  noPercent: percent(tally.no, tally.total),
  abstainPercent: percent(tally.abstain, tally.total),
  yesCount: tally.yes,
  noCount: tally.no,
  abstainCount: tally.abstain,
});

const formatVoterType = (type: VoterType): VoteRecord["voterType"] => {
  switch (type) {
    case VoterType.DREP:
      return "DRep";
    case VoterType.SPO:
      return "SPO";
    case VoterType.CC:
    default:
      return "CC";
  }
};

const formatVoteChoice = (vote?: VoteType | null): VoteRecord["vote"] => {
  if (vote === VoteType.YES) {
    return "Yes";
  }
  if (vote === VoteType.NO) {
    return "No";
  }
  return "Abstain";
};

const formatVoteDate = (value?: Date | null) =>
  value ? value.toISOString() : new Date().toISOString();

const resolveVoterId = (vote: VoteWithRelations): string => {
  if (vote.voterType === VoterType.DREP) {
    return vote.drep?.drepId ?? vote.drepId ?? vote.id;
  }

  if (vote.voterType === VoterType.SPO) {
    return vote.spo?.poolId ?? vote.spoId ?? vote.id;
  }

  return vote.cc?.ccId ?? vote.ccId ?? vote.id;
};

const resolveVoterName = (vote: VoteWithRelations): string | undefined => {
  if (vote.voterType === VoterType.DREP) {
    // Prefer the DRep's display name, falling back to their payment address if available
    return vote.drep?.name ?? vote.drep?.paymentAddress ?? undefined;
  }

  if (vote.voterType === VoterType.SPO) {
    return vote.spo?.poolName ?? vote.spo?.ticker ?? undefined;
  }

  return vote.cc?.memberName ?? undefined;
};

const mapVoteRecord = (vote: VoteWithRelations): VoteRecord => {
  const record: VoteRecord = {
    voterType: formatVoterType(vote.voterType),
    voterId: resolveVoterId(vote),
    vote: formatVoteChoice(vote.vote),
    votedAt: formatVoteDate(vote.votedAt ?? vote.createdAt ?? vote.updatedAt),
  };

  const voterName = resolveVoterName(vote);
  if (voterName) {
    record.voterName = voterName;
  }

  // votingPower is stored as BigInt in lovelace, convert to string for API response
  if (vote.votingPower !== null && vote.votingPower !== undefined) {
    record.votingPower = vote.votingPower.toString();
  }

  if (vote.anchorUrl) {
    record.anchorUrl = vote.anchorUrl;
  }

  if (vote.anchorHash) {
    record.anchorHash = vote.anchorHash;
  }

  return record;
};

/**
 * Determines constitutionality based on CC (Constitutional Committee) voting results
 * A proposal is considered "Constitutional" if it receives ≥67% "Yes" votes from CC members
 * Abstain votes ARE included in the total for threshold calculation
 *
 * @param ccCountTally - The CC vote count tally
 * @returns "Constitutional", "Unconstitutional", or "Pending" if no CC votes yet
 */
const determineConstitutionality = (ccCountTally: CountTally): string => {
  const totalCcVotes =
    ccCountTally.yes + ccCountTally.no + ccCountTally.abstain;

  // If no CC votes yet
  if (totalCcVotes === 0) {
    return "Pending";
  }

  // Calculate yes percentage (including abstain votes in total)
  const yesPercent = (ccCountTally.yes / totalCcVotes) * 100;

  // ≥67% threshold for constitutional approval
  if (yesPercent >= 67) {
    return "Constitutional";
  }

  return "Unconstitutional";
};

const aggregateVotes = (votes: VoteWithRelations[]) => {
  const drepVotes = votes.filter((vote) => vote.voterType === VoterType.DREP);
  const spoVotes = votes.filter((vote) => vote.voterType === VoterType.SPO);
  const ccVotes = votes.filter((vote) => vote.voterType === VoterType.CC);

  // Tally voting power in lovelace
  const drepLovelaceTally = tallyLovelaceVotes(drepVotes);
  const spoLovelaceTally = tallyLovelaceVotes(spoVotes);
  const ccCountTally = tallyCountVotes(ccVotes);

  const drepCountTally = tallyCountVotes(drepVotes);
  const spoCountTally = tallyCountVotes(spoVotes);
  const totals = combineCountTallies(
    drepCountTally,
    spoCountTally,
    ccCountTally
  );

  return {
    drepVotes,
    spoVotes,
    ccVotes,
    drepLovelaceTally,
    spoLovelaceTally,
    ccCountTally,
    totals,
  };
};

const buildProposalIdentifier = (proposal: ProposalWithVotes) => {
  // Use the proposalId field from the database (Cardano governance action ID)
  if (proposal.proposalId) {
    return proposal.proposalId;
  }

  // Fallback to txHash:certIndex format if proposalId is not available
  if (proposal.txHash) {
    if (proposal.certIndex !== null && proposal.certIndex !== undefined) {
      return `${proposal.txHash}:${proposal.certIndex}`;
    }
    return proposal.txHash;
  }

  return proposal.id.toString();
};

export const mapProposalToGovernanceAction = (
  proposal: ProposalWithVotes
): GovernanceAction => {
  const voteAggregation = aggregateVotes(proposal.onchainVotes ?? []);

  // Use new voting power-based calculations if data is available, otherwise fall back to vote tally
  const hasDrepVotingPowerData =
    proposal.drepTotalVotePower !== null &&
    proposal.drepTotalVotePower !== undefined;
  const drepInfo = hasDrepVotingPowerData
    ? buildDrepVoteInfo(proposal)
    : buildVoteInfo(voteAggregation.drepLovelaceTally);

  // SPO info uses new formula if voting power data exists
  const spoInfo =
    buildSpoVoteInfo(proposal) ??
    (voteAggregation.spoVotes.length
      ? buildVoteInfo(voteAggregation.spoLovelaceTally)
      : undefined);

  const ccInfo = voteAggregation.ccVotes.length
    ? buildCcVoteInfo(voteAggregation.ccCountTally)
    : undefined;

  // Determine constitutionality based on CC voting results (≥67% Yes = Constitutional)
  const constitutionality = determineConstitutionality(
    voteAggregation.ccCountTally
  );

  // Build hash field (txHash:certIndex format)
  const hash = proposal.certIndex
    ? `${proposal.txHash}:${proposal.certIndex}`
    : proposal.txHash;

  return {
    proposalId: buildProposalIdentifier(proposal),
    hash,
    title: proposal.title,
    type: formatGovernanceType(proposal.governanceActionType),
    status: formatStatus(proposal.status),
    constitutionality,
    drep: drepInfo,
    spo: spoInfo,
    cc: ccInfo,
    totalYes: voteAggregation.totals.yes,
    totalNo: voteAggregation.totals.no,
    totalAbstain: voteAggregation.totals.abstain,
    submissionEpoch: proposal.submissionEpoch ?? 0,
    expiryEpoch: proposal.expirationEpoch ?? 0,
  };
};

export const mapProposalToGovernanceActionDetail = (
  proposal: ProposalWithVotes
): GovernanceActionDetail => {
  const base = mapProposalToGovernanceAction(proposal);
  const votes = proposal.onchainVotes ?? [];
  const standardVotes = votes.filter((vote) => vote.voterType !== VoterType.CC);
  const ccVotes = votes.filter((vote) => vote.voterType === VoterType.CC);

  const mappedVotes = standardVotes.map(mapVoteRecord);
  const mappedCcVotes = ccVotes.map(mapVoteRecord);

  return {
    ...base,
    description: proposal.description ?? undefined,
    rationale: proposal.rationale ?? undefined,
    votes: mappedVotes.length ? mappedVotes : undefined,
    ccVotes: mappedCcVotes.length ? mappedCcVotes : undefined,
  };
};
