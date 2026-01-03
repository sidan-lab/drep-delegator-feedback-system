import { GovernanceAction, NCLData, ProposalSummary } from "../models";

export type GetNCLDataResponse = ProposalSummary & {
  nclData: NCLData[];
};

export type GetProposalListReponse = GovernanceAction[];
