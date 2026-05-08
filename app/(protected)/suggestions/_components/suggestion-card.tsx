import Link from "next/link";
import { format } from "date-fns";
import { StatusActions } from "./status-actions";
import { LinkInterventionDialog } from "./link-intervention";

type Status =
  | "open"
  | "under_review"
  | "accepted"
  | "in_progress"
  | "declined"
  | "shipped";

const STATUS_DOT: Record<Status, string> = {
  open: "bg-zinc-400",
  under_review: "bg-amber-500",
  accepted: "bg-blue-500",
  in_progress: "bg-blue-600",
  shipped: "bg-emerald-500",
  declined: "bg-red-500",
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  under_review: "Under review",
  accepted: "Accepted",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
};

export type SuggestionRow = {
  id: string;
  title: string;
  body: string;
  workflow_id: string | null;
  workflow_name: string | null;
  team: string | null;
  status: Status;
  decline_reason: string | null;
  intervention_id: string | null;
  intervention_name: string | null;
  created_at: string;
  submitted_by: string | null;
  voteCount: number;
  voted: boolean;
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
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">{voteSlot}</div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={`/suggestions/${suggestion.id}`}
              className="font-medium text-zinc-900 hover:underline"
            >
              {suggestion.title}
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${STATUS_DOT[suggestion.status]}`}
              />
              {STATUS_LABEL[suggestion.status]}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-zinc-700">
            {suggestion.body}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {suggestion.submitted_by && (
              <span>by {suggestion.submitted_by}</span>
            )}
            {suggestion.team && (
              <>
                <span aria-hidden>·</span>
                <span>{suggestion.team}</span>
              </>
            )}
            {suggestion.workflow_id && suggestion.workflow_name && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/workflows/${suggestion.workflow_id}`}
                  className="hover:text-zinc-900 hover:underline"
                >
                  {suggestion.workflow_name}
                </Link>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {format(new Date(suggestion.created_at), "d MMM yyyy")}
            </span>
          </div>

          {suggestion.status === "declined" && suggestion.decline_reason && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <span className="font-medium text-zinc-900">Declined:</span>{" "}
              {suggestion.decline_reason}
            </p>
          )}

          {suggestion.status === "shipped" &&
            suggestion.intervention_id &&
            suggestion.intervention_name && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                Shipped via{" "}
                <Link
                  href={`/interventions/${suggestion.intervention_id}`}
                  className="font-medium underline"
                >
                  {suggestion.intervention_name}
                </Link>
                .
              </p>
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
