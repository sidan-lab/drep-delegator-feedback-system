import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";

/**
 * Format ADA value with commas for readability
 */
function formatAda(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function GovernanceStats() {
  const actions = useAppSelector((state) => state.governance.actions);
  const overview = useAppSelector((state) => state.governance.overview);
  const nclData = useAppSelector((state) => state.governance.nclData);

  // Calculate stats from actions if overview not available
  const stats = overview
    ? {
        total: overview.totalProposals,
        active: overview.activeProposals,
        ratified: overview.ratifiedProposals,
        enacted: overview.enactedProposals,
        expired: overview.expiredProposals,
        closed: overview.closedProposals,
      }
    : {
        total: actions.length,
        active: actions.filter((a) => a.status === "Active").length,
        ratified: actions.filter((a) => a.status === "Ratified").length,
        enacted: actions.filter((a) => a.status === "Enacted").length,
        expired: actions.filter((a) => a.status === "Expired").length,
        closed: actions.filter((a) => a.status === "Closed").length,
      };

  // Calculate progress percentage (active / total)
  const activePercent =
    stats.total > 0 ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Left card: Total Governance Actions + Active Proposals */}
      <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
        <div className="text-5xl font-bold text-primary mb-2">
          {stats.total}
        </div>
        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-4">
          Total Governance Actions
        </div>
        <div className="border-t border-primary/20 pt-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-foreground">
              {stats.active}
            </span>
            <span className="text-sm text-muted-foreground">
              / {stats.total} total
            </span>
          </div>
          <Progress value={activePercent} className="h-2 mb-2" />
          <div className="text-right">
            <span className="text-lg font-bold text-success">
              {activePercent.toFixed(1)}% active
            </span>
          </div>
        </div>
      </Card>

      {/* Middle card: Status Breakdown */}
      <Card className="p-6 border-border/50">
        <div className="text-2xl font-semibold text-foreground mb-3">
          Status Breakdown
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Active</span>
            <span className="text-success font-semibold">{stats.active}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Ratified</span>
            <span className="text-primary font-semibold">{stats.ratified}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Enacted</span>
            <span className="text-blue-500 font-semibold">{stats.enacted}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Expired/Closed</span>
            <span className="text-muted-foreground font-semibold">
              {stats.expired + stats.closed}
            </span>
          </div>
        </div>
      </Card>

      {/* Right card: NCL Data */}
      <Card className="p-6 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30">
        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
          NCL {nclData?.year || new Date().getFullYear()}
        </div>
        {nclData ? (
          <>
            <div className="mb-3">
              <span className="text-2xl font-bold text-foreground">
                {formatAda(nclData.currentValueAda)} / {formatAda(nclData.targetValueAda)} ADA
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={Math.min(nclData.percentUsed, 100)}
                className="h-2 flex-1"
              />
              <span className="text-sm text-amber-500 font-semibold">
                {nclData.percentUsed.toFixed(1)}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground text-sm">
            NCL data not available
          </div>
        )}
      </Card>
    </div>
  );
}
