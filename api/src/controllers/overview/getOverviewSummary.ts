import { Request, Response } from "express";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "../../services";
import { GetNCLDataResponse } from "../../responses";
import { NCLData } from "../../models";
import { syncProposalsOverviewOnRead } from "../../services/syncOnRead";

type StatusCountMap = Partial<Record<ProposalStatus, number>>;

// Years to include in NCL response (2025 extended, 2026 current)
const NCL_YEARS = [2025, 2026];

export const getOverviewSummary = async (_req: Request, res: Response) => {
  try {
    // Trigger background sync for new proposals (non-blocking).
    // The sync runs in the background while we return data from the database.
    // New proposals will be available on the next request after sync completes.
    syncProposalsOverviewOnRead();

    const [totalProposals, grouped, nclRecords] = await Promise.all([
      prisma.proposal.count(),
      prisma.proposal.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.nCL.findMany({
        where: { year: { in: NCL_YEARS } },
        orderBy: { year: "desc" },
      }),
    ]);

    const counts = grouped.reduce<StatusCountMap>((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    const currentlyRatified = counts[ProposalStatus.RATIFIED] ?? 0;
    const enacted = counts[ProposalStatus.ENACTED] ?? 0;

    const summary = {
      totalProposals,
      activeProposals: counts[ProposalStatus.ACTIVE] ?? 0,
      // Ratified = currently ratified + enacted (since enacted proposals were ratified first)
      ratifiedProposals: currentlyRatified + enacted,
      enactedProposals: enacted,
      expiredProposals: counts[ProposalStatus.EXPIRED] ?? 0,
      closedProposals: counts[ProposalStatus.CLOSED] ?? 0,
    };

    // Convert NCL records to response format
    const nclData: NCLData[] = nclRecords.map((record) => ({
      year: record.year,
      currentValue: record.current.toString(),
      targetValue: record.limit.toString(),
    }));

    const response: GetNCLDataResponse = {
      ...summary,
      nclData,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching overview summary", error);
    res.status(500).json({
      error: "Failed to fetch overview data",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
