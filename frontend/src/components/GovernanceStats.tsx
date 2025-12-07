import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppSelector } from "@/store/hooks";

export function GovernanceStats() {
  const actions = useAppSelector((state) => state.governance.actions);
  const overview = useAppSelector((state) => state.governance.overview);

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
  const progressPercent =
    stats.total > 0 ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
        <div className="text-5xl font-bold text-primary mb-2">{stats.total}</div>
        <div className="text-sm text-muted-foreground uppercase tracking-wide">
          Total Governance Actions
        </div>
      </Card>

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

      <Card className="p-6 bg-gradient-to-br from-success/20 to-success/5 border-success/30">
        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
          Active Proposals
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-foreground">
            {stats.active}
          </span>
          <span className="text-lg text-muted-foreground">
            / {stats.total} total
          </span>
        </div>
        <Progress value={progressPercent} className="h-2 mb-2" />
        <div className="text-right">
          <span className="text-xl font-bold text-success">
            {progressPercent.toFixed(1)}% active
          </span>
        </div>
      </Card>
    </div>
  );
}
