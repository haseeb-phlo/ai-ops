import { redirect } from "next/navigation";
import { LightbulbIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitSuggestionDialog } from "./_components/submit-dialog";
import { SuggestionTabs, type Tab } from "./_components/tabs";
import {
  SuggestionCard,
  type SuggestionRow,
} from "./_components/suggestion-card";
import { VoteButton } from "./_components/vote-button";

type RawSuggestion = {
  id: string;
  title: string;
  body: string;
  workflow_id: string | null;
  team: string | null;
  status: SuggestionRow["status"];
  decline_reason: string | null;
  intervention_id: string | null;
  created_by: string | null;
  created_at: string;
};

const VALID_TABS: Tab[] = ["active", "declined"];

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  // The roadmap graduated from a tab here to its own section; keep old
  // links working.
  if (sp.tab === "roadmap") redirect("/roadmap");
  const tab: Tab =
    typeof sp.tab === "string" && VALID_TABS.includes(sp.tab as Tab)
      ? (sp.tab as Tab)
      : "active";

  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: rows },
    { data: workflows },
    { data: interventions },
    { data: profileRows },
    { data: voteRows },
    { data: commentRows },
    { data: peopleRows },
    { data: myChampionRows },
  ] = await Promise.all([
    supabase
      .from("intervention_suggestions")
      .select(
        "id, title, body, workflow_id, team, status, decline_reason, intervention_id, created_by, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<RawSuggestion[]>(),
    supabase
      .from("workflows")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status")
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; status: string | null }[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .returns<{ user_id: string; display_name: string | null }[]>(),
    supabase
      .from("intervention_suggestion_votes")
      .select("suggestion_id, user_id")
      .returns<{ suggestion_id: string; user_id: string }[]>(),
    supabase
      .from("intervention_suggestion_comments")
      .select("suggestion_id")
      .returns<{ suggestion_id: string }[]>(),
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

  // Resolve user_id → email only for the authors that actually appear on
  // this page. user_emails requires an explicit user_id list (see migration).
  const authorIds = Array.from(
    new Set((rows ?? []).map((r) => r.created_by).filter((v): v is string => !!v)),
  );
  const { data: emailRows } =
    authorIds.length === 0
      ? { data: [] as { user_id: string; email: string | null }[] }
      : await supabase.rpc("user_emails", { p_user_ids: authorIds });

  const allRows = rows ?? [];
  const workflowsList = workflows ?? [];
  const workflowNameById = new Map(workflowsList.map((w) => [w.id, w.name]));
  const interventionsList = interventions ?? [];
  const activeInterventions = interventionsList.filter(
    (i) => i.status === "active",
  );
  const interventionNameById = new Map(
    interventionsList.map((i) => [i.id, i.name]),
  );

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
    return resolveDisplayName(profileNameByUserId.get(userId), peopleName, email) || null;
  }

  const votesBySuggestion = new Map<string, number>();
  const votedSet = new Set<string>();
  for (const v of voteRows ?? []) {
    votesBySuggestion.set(
      v.suggestion_id,
      (votesBySuggestion.get(v.suggestion_id) ?? 0) + 1,
    );
    if (v.user_id === user.id) votedSet.add(v.suggestion_id);
  }

  const commentsBySuggestion = new Map<string, number>();
  for (const c of commentRows ?? []) {
    commentsBySuggestion.set(
      c.suggestion_id,
      (commentsBySuggestion.get(c.suggestion_id) ?? 0) + 1,
    );
  }

  const isSuper = user.role === "super_admin";

  function decorate(s: RawSuggestion): SuggestionRow {
    return {
      id: s.id,
      title: s.title,
      body: s.body,
      workflow_id: s.workflow_id,
      workflow_name: s.workflow_id
        ? workflowNameById.get(s.workflow_id) ?? null
        : null,
      team: s.team,
      status: s.status,
      decline_reason: s.decline_reason,
      intervention_id: s.intervention_id,
      intervention_name: s.intervention_id
        ? interventionNameById.get(s.intervention_id) ?? null
        : null,
      created_at: s.created_at,
      submitted_by: nameFor(s.created_by),
      voteCount: votesBySuggestion.get(s.id) ?? 0,
      voted: votedSet.has(s.id),
      commentCount: commentsBySuggestion.get(s.id) ?? 0,
    };
  }

  const decorated = allRows.map(decorate);

  const activeRows = decorated.filter(
    (s) => s.status === "open" || s.status === "under_review",
  );
  // Active sort: most-voted first, ties broken by newest.
  activeRows.sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return b.created_at.localeCompare(a.created_at);
  });
  const declinedRows = decorated.filter((s) => s.status === "declined");

  const myChampionTeams = new Set(
    (myChampionRows ?? []).map((r) => r.team),
  );
  function canTriageFor(team: string | null): boolean {
    if (!team) return false;
    return myChampionTeams.has(team);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Suggestions"
        description="Submit ideas and vote on them. Accepted ideas move to the Roadmap."
        actions={<SubmitSuggestionDialog workflows={workflowsList} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SuggestionTabs active={tab} />
      </div>

      {tab === "active" && (
        <>
          {activeRows.length > 1 && (
            <p className="text-xs text-muted-foreground">Sorted by votes</p>
          )}
          <ActiveList
            rows={activeRows}
            isSuper={isSuper}
            canTriageFor={canTriageFor}
            activeInterventions={activeInterventions}
            emptyTitle="No active suggestions"
            emptyDescription={
              'Ideas land here for voting and triage. Use "Suggest something" to add the first one.'
            }
          />
        </>
      )}
      {tab === "declined" && (
        <ActiveList
          rows={declinedRows}
          isSuper={isSuper}
          canTriageFor={canTriageFor}
          activeInterventions={activeInterventions}
          emptyTitle="No declined suggestions"
          emptyDescription="Suggestions declined during triage appear here, with the reason."
        />
      )}
    </PageContainer>
  );
}

function ActiveList({
  rows,
  isSuper,
  canTriageFor,
  activeInterventions,
  emptyTitle,
  emptyDescription,
}: {
  rows: SuggestionRow[];
  isSuper: boolean;
  canTriageFor: (team: string | null) => boolean;
  activeInterventions: { id: string; name: string }[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<LightbulbIcon aria-hidden />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          voteSlot={
            <VoteButton
              suggestionId={s.id}
              count={s.voteCount}
              voted={s.voted}
            />
          }
          canTriage={isSuper || canTriageFor(s.team)}
          canCommit={isSuper}
          activeInterventions={activeInterventions}
        />
      ))}
    </ul>
  );
}
