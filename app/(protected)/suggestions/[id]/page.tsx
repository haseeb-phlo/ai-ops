import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { championsByTeam } from "@/lib/champions";
import { PageContainer } from "@/components/page-header";
import { DetailHeader } from "@/components/ui/detail-header";
import { StatusActions } from "../_components/status-actions";
import { LinkInterventionDialog } from "../_components/link-intervention";
import { VoteButton } from "../_components/vote-button";
import { CommentForm } from "./_components/comment-form";
import { CommentRow } from "./_components/comment-row";
import { DeleteSuggestionButton } from "./_components/delete-suggestion";

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

type Suggestion = {
  id: string;
  title: string;
  body: string;
  workflow_id: string | null;
  team: string | null;
  status: Status;
  decline_reason: string | null;
  intervention_id: string | null;
  created_by: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
};

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: suggestion },
    { data: comments },
    { data: profileRows },
    { data: voteRows },
    { data: workflows },
    { data: interventions },
    byTeam,
  ] = await Promise.all([
    supabase
      .from("intervention_suggestions")
      .select(
        "id, title, body, workflow_id, team, status, decline_reason, intervention_id, created_by, created_at",
      )
      .eq("id", id)
      .maybeSingle<Suggestion>(),
    supabase
      .from("intervention_suggestion_comments")
      .select("id, body, created_at, created_by")
      .eq("suggestion_id", id)
      .order("created_at", { ascending: true })
      .returns<Comment[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .returns<{ user_id: string; display_name: string | null }[]>(),
    supabase
      .from("intervention_suggestion_votes")
      .select("suggestion_id, user_id")
      .eq("suggestion_id", id)
      .returns<{ suggestion_id: string; user_id: string }[]>(),
    supabase
      .from("workflows")
      .select("id, name")
      .is("deleted_at", null)
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status")
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; status: string | null }[]>(),
    championsByTeam(),
  ]);

  if (!suggestion) {
    notFound();
  }

  const profileNameByUserId = new Map<string, string>();
  for (const p of profileRows ?? []) {
    if (p.display_name?.trim()) {
      profileNameByUserId.set(p.user_id, p.display_name.trim());
    }
  }
  const submittedBy = suggestion.created_by
    ? profileNameByUserId.get(suggestion.created_by) ?? null
    : null;
  const workflowName = suggestion.workflow_id
    ? (workflows ?? []).find((w) => w.id === suggestion.workflow_id)?.name ??
      null
    : null;
  const linkedIntervention = suggestion.intervention_id
    ? (interventions ?? []).find((i) => i.id === suggestion.intervention_id) ??
      null
    : null;

  const voteCount = voteRows?.length ?? 0;
  const voted = (voteRows ?? []).some((v) => v.user_id === user.id);

  const isSuper = user.role === "super_admin";
  const isChampion = (() => {
    if (!suggestion.team) return false;
    const champ = byTeam.get(suggestion.team);
    return champ?.user_id === user.id;
  })();
  const canTriage = isSuper || isChampion;
  const canCommit = isSuper;

  const activeInterventions = (interventions ?? []).filter(
    (i) => i.status === "active",
  );

  return (
    <PageContainer>
      <DetailHeader
        backHref="/suggestions"
        backLabel="All suggestions"
        title={suggestion.title}
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {suggestion.title}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${STATUS_DOT[suggestion.status]}`}
            />
            {STATUS_LABEL[suggestion.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {submittedBy && <span>by {submittedBy}</span>}
          {suggestion.team && (
            <>
              <span aria-hidden>·</span>
              <span>{suggestion.team}</span>
            </>
          )}
          {workflowName && suggestion.workflow_id && (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/workflows/${suggestion.workflow_id}`}
                className="hover:text-zinc-900 hover:underline"
              >
                {workflowName}
              </Link>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {format(new Date(suggestion.created_at), "d MMM yyyy")}
          </span>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <VoteButton
            suggestionId={suggestion.id}
            count={voteCount}
            voted={voted}
          />
          <div className="min-w-0 flex-1 space-y-4">
            <p className="whitespace-pre-wrap text-sm text-zinc-800">
              {suggestion.body}
            </p>

            {suggestion.status === "declined" && suggestion.decline_reason && (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Declined:</span>{" "}
                {suggestion.decline_reason}
              </p>
            )}

            {suggestion.status === "shipped" && linkedIntervention && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Shipped via{" "}
                <Link
                  href={`/interventions/${linkedIntervention.id}`}
                  className="font-medium underline"
                >
                  {linkedIntervention.name}
                </Link>
                .
              </p>
            )}

            {(canTriage || canCommit) && suggestion.status !== "shipped" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
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
                {isSuper && (
                  <DeleteSuggestionButton
                    suggestionId={suggestion.id}
                    title={suggestion.title}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Comments
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white">
          {(comments ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-400">
              No comments yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(comments ?? []).map((c) => {
                const authorName = c.created_by
                  ? profileNameByUserId.get(c.created_by) ?? "Someone"
                  : "Someone";
                const canDelete =
                  isSuper || (c.created_by && c.created_by === user.id);
                return (
                  <CommentRow
                    key={c.id}
                    id={c.id}
                    suggestionId={suggestion.id}
                    body={c.body}
                    authorName={authorName}
                    createdAt={c.created_at}
                    canDelete={!!canDelete}
                  />
                );
              })}
            </ul>
          )}
        </div>
        <CommentForm suggestionId={suggestion.id} />
      </section>
    </PageContainer>
  );
}
