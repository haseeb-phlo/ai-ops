import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { MessageSquareIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
import { SUGGESTION_STATUS, type SuggestionStatus } from "@/lib/status";
import { PageContainer } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { DetailHeader } from "@/components/ui/detail-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentRow } from "@/components/comments/comment-row";
import { StatusActions } from "../_components/status-actions";
import { LinkInterventionDialog } from "../_components/link-intervention";
import { VoteButton } from "../_components/vote-button";
import { DeleteSuggestionButton } from "./_components/delete-suggestion";
import {
  createSuggestionComment,
  deleteSuggestionComment,
} from "../actions";

type Status = SuggestionStatus;

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
    { data: peopleRows },
    { data: myChampionRows },
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
    supabase
      .from("people")
      .select("email, display_name")
      .returns<{ email: string; display_name: string }[]>(),
    supabase
      .from("champions")
      .select("team")
      .eq("user_id", user.id)
      .returns<{ team: string }[]>(),
  ]);

  if (!suggestion) {
    notFound();
  }

  // Resolve user_id → email for just the people on this page (suggestion
  // author + commenters). user_emails requires an explicit user_id list.
  const pageUserIds = Array.from(
    new Set(
      [
        suggestion.created_by,
        ...((comments ?? []).map((c) => c.created_by)),
      ].filter((v): v is string => !!v),
    ),
  );
  const { data: emailRows } =
    pageUserIds.length === 0
      ? { data: [] as { user_id: string; email: string | null }[] }
      : await supabase.rpc("user_emails", { p_user_ids: pageUserIds });

  const profileNameByUserId = new Map<string, string | null>();
  for (const p of profileRows ?? []) {
    profileNameByUserId.set(p.user_id, p.display_name);
  }
  const peopleNameByEmail = new Map<string, string>();
  for (const p of peopleRows ?? []) {
    if (p.email && p.display_name) {
      peopleNameByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }
  const emailByUserId = new Map<string, string | null>();
  for (const r of (emailRows ?? []) as { user_id: string; email: string | null }[]) {
    emailByUserId.set(r.user_id, r.email);
  }
  function nameFor(userId: string | null): string | null {
    if (!userId) return null;
    const email = emailByUserId.get(userId) ?? null;
    const peopleName = email
      ? peopleNameByEmail.get(email.trim().toLowerCase()) ?? null
      : null;
    return (
      resolveDisplayName(profileNameByUserId.get(userId), peopleName, email) ||
      null
    );
  }
  const submittedBy = nameFor(suggestion.created_by);
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
  const isChampion =
    !!suggestion.team &&
    (myChampionRows ?? []).some((r) => r.team === suggestion.team);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {suggestion.title}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${SUGGESTION_STATUS[suggestion.status].dotClassName}`}
            />
            {SUGGESTION_STATUS[suggestion.status].label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                className="hover:text-foreground hover:underline"
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

      <section className="rounded-lg border border-border bg-background p-6">
        <div className="flex items-start gap-4">
          <VoteButton
            suggestionId={suggestion.id}
            count={voteCount}
            voted={voted}
          />
          <div className="min-w-0 flex-1 space-y-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {suggestion.body}
            </p>

            {suggestion.status === "declined" && suggestion.decline_reason && (
              <Alert variant="info">
                <span className="font-medium text-foreground">Declined:</span>{" "}
                {suggestion.decline_reason}
              </Alert>
            )}

            {suggestion.status === "shipped" && linkedIntervention && (
              <Alert variant="success">
                Shipped via{" "}
                <Link
                  href={`/interventions/${linkedIntervention.id}`}
                  className="font-medium underline"
                >
                  {linkedIntervention.name}
                </Link>
                .
              </Alert>
            )}

            {(canTriage || canCommit) && suggestion.status !== "shipped" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Comments
        </h2>
        {(comments ?? []).length === 0 ? (
          <EmptyState
            icon={<MessageSquareIcon aria-hidden />}
            title="No comments yet"
            description="Start the discussion below."
            className="py-8"
          />
        ) : (
          <div className="rounded-lg border border-border bg-background">
            <ul className="divide-y divide-border">
              {(comments ?? []).map((c) => {
                const authorName = nameFor(c.created_by) ?? "Someone";
                const canDelete =
                  isSuper || (c.created_by && c.created_by === user.id);
                return (
                  <CommentRow
                    key={c.id}
                    commentId={c.id}
                    body={c.body}
                    authorName={authorName}
                    createdAt={c.created_at}
                    canDelete={!!canDelete}
                    deleteAction={deleteSuggestionComment}
                    hiddenFieldName="suggestion_id"
                    hiddenFieldValue={suggestion.id}
                  />
                );
              })}
            </ul>
          </div>
        )}
        <CommentForm
          action={createSuggestionComment}
          hiddenFieldName="suggestion_id"
          hiddenFieldValue={suggestion.id}
        />
      </section>
    </PageContainer>
  );
}
