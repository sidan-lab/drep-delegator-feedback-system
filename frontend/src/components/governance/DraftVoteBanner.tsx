import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

interface DraftVoteBannerProps {
  vote: "YES" | "NO" | "ABSTAIN";
  publishedAt: string;
  rationaleUrl?: string;
  onFinalize: () => void;
}

export function DraftVoteBanner({
  vote,
  publishedAt,
  rationaleUrl,
  onFinalize,
}: DraftVoteBannerProps) {
  const formattedDate = new Date(publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const voteColor =
    vote === "YES"
      ? "text-emerald-400"
      : vote === "NO"
        ? "text-red-400"
        : "text-gray-400";

  return (
    <Card className="p-4 border-yellow-500/50 bg-yellow-500/10 mb-4">
      {/* Top Section: Vote Statement */}
      <div className="mb-3">
        <p className="font-semibold text-sm mb-1">
          Draft Vote Intent:{" "}
          <span className={voteColor}>{vote}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Published {formattedDate}</span>
          {rationaleUrl && (
            <>
              <span>•</span>
              <a
                href={rationaleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline"
              >
                View rationale
              </a>
            </>
          )}
        </div>
      </div>

      {/* Bottom Section: Badge and Action Button */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        >
          📝 DRAFT
        </Badge>
        <Button
          variant="default"
          size="sm"
          onClick={onFinalize}
          className="text-xs"
        >
          <Send className="h-3 w-3 mr-1" />
          Finalize On-Chain
        </Button>
      </div>

      {/* Warning Message */}
      <p className="text-xs text-muted-foreground mt-3">
        ⚠️ This is a preliminary position. Delegators can see this, but it&apos;s not
        recorded on-chain yet. Click &quot;Finalize On-Chain&quot; to cast your final vote.
      </p>
    </Card>
  );
}
