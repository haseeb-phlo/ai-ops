import Link from "next/link";
import { format } from "date-fns";
import { MessageSquareIcon } from "lucide-react";
import { SUGGESTION_STATUS, type SuggestionStatus } from "@/lib/status";
import { Alert } from "@/components/ui/alert";
import { StatusActions } from "./status-actions";
import { LinkInterventionDialog } from "./link-intervention";

export type SuggestionRow = {
  id: string;
  title: string;
  body: string;
  workflows: { id: string; name: string }[];
  team: string | null;
  status: SuggestionStatus;
  decline_reason: string | null;
  intervention_id: string | null;
  intervention_name: string | null;
  created_at: string;
  submitted_by: string | null;
  voteCount: number;
  voted: boolean;
  commentCount: number;
};

export function SuggestionCard({
  suggestion,
  voteSlot,
  canTriage,
  canCommit,
  activeInterventions,
}: {
  suggestion: SuggestionRow;
  voteSlot: React.ReactNode;
  canTriage: boolean;
  canCommit: boolean;
  activeInterventions: { id: string; name: string }[];
}) {
  const status = SUGGESTION_STATUS[suggestion.status];
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">{voteSlot}</div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={`/suggestions/${suggestion.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {suggestion.title}
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${status.dotClassName}`}
              />
              {status.label}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {suggestion.body}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {suggestion.submitted_by && (
              <span>by {suggestion.submitted_by}</span>
            )}
            {suggestion.team && (
              <>
                <span aria-hidden>·</span>
                <span>{suggestion.team}</span>
              </>
            )}
            {suggestion.workflows.map((w) => (
              <span key={w.id} className="inline-flex items-center gap-x-3">
                <span aria-hidden>·</span>
                <Link
                  href={`/workflows/${w.id}`}
                  className="hover:text-foreground hover:underline"
                >
                  {w.name}
                </Link>
              </span>
            ))}
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {format(new Date(suggestion.created_at), "d MMM yyyy")}
            </span>
            {suggestion.commentCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/suggestions/${suggestion.id}`}
                  className="inline-flex items-center gap-1 tabular-nums hover:text-foreground"
                >
                  <MessageSquareIcon aria-hidden className="size-3" />
                  {suggestion.commentCount}
                  <span className="sr-only">
                    {suggestion.commentCount === 1 ? "comment" : "comments"}
                  </span>
                </Link>
              </>
            )}
          </div>

          {suggestion.status === "declined" && suggestion.decline_reason && (
            <Alert variant="info" className="text-xs">
              <span className="font-medium text-foreground">Declined:</span>{" "}
              {suggestion.decline_reason}
            </Alert>
          )}

          {suggestion.status === "shipped" &&
            suggestion.intervention_id &&
            suggestion.intervention_name && (
              <Alert variant="success" className="text-xs">
                Shipped via{" "}
                <Link
                  href={`/interventions/${suggestion.intervention_id}`}
                  className="font-medium underline"
                >
                  {suggestion.intervention_name}
                </Link>
                .
              </Alert>
            )}

          {(canTriage || canCommit) && suggestion.status !== "shipped" && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusActions
                suggestionId={suggestion.id}
                status={suggestion.status}
                canTriage={canTriage}
                canCommit={canCommit}
              />
              {canCommit &&
                (suggestion.status === "accepted" ||
                  suggestion.status === "queued" ||
                  suggestion.status === "in_progress") && (
                <LinkInterventionDialog
                  suggestionId={suggestion.id}
                  interventions={activeInterventions}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
