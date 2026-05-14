import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { championsByTeam } from "@/lib/champions";
import { resolveDisplayName } from "@/lib/profile";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SubmitSuggestionDialog } from "./_components/submit-dialog";
import { SuggestionTabs, type Tab } from "./_components/tabs";
import {
  SuggestionCard,
  type SuggestionRow,
} from "./_components/suggestion-card";
import { RoadmapBoard } from "./_components/roadmap";
import { VoteButton } from "./_components/vote-button";
import { ViewToggle, type ViewMode } from "./_components/view-toggle";

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

const VALID_TABS: Tab[] = ["active", "roadmap", "declined"];

const ROADMAP_STATUSES = new Set<SuggestionRow["status"]>([
  "accepted",
  "in_progress",
  "shipped",
]);

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab =
    typeof sp.tab === "string" && VALID_TABS.includes(sp.tab as Tab)
      ? (sp.tab as Tab)
      : "roadmap";

  const view: ViewMode =
    sp.view === "list" || sp.view === "board"
      ? sp.view
      : tab === "roadmap"
        ? "board"
        : "list";

  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: rows },
    { data: workflows },
    { data: interventions },
    { data: profileRows },
    { data: voteRows },
    { data: peopleRows },
    { data: emailRows },
    byTeam,
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
      .from("people")
      .select("email, display_name")
      .returns<{ email: string; display_name: string }[]>(),
    supabase.rpc("user_emails"),
    championsByTeam(),
  ]);

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
    };
  }

  const decorated = allRows.map(decorate);

  // Lane groupings for the roadmap. Status-only mapping after the
  // in_progress migration: each suggestion sits in exactly one lane and
  // moves between them by status alone.
  const roadmapGroups = {
    up_next: decorated.filter((s) => s.status === "accepted"),
    in_progress: decorated.filter((s) => s.status === "in_progress"),
    shipped: decorated.filter((s) => s.status === "shipped"),
  };

  // Initiative lane mapping mirrors the suggestion lanes by intent:
  //   paused   -> "Up next"      (planned / on hold)
  //   active   -> "In progress"  (the default for a freshly logged one)
  //   retired  -> "Shipped"      (sunset / done)
  // Dragging a card writes the corresponding status back via
  // moveInitiativeLane.
  const initiativeRoadmapGroups = {
    up_next: interventionsList.filter((i) => i.status === "paused"),
    in_progress: interventionsList.filter((i) => i.status === "active"),
    shipped: interventionsList.filter((i) => i.status === "retired"),
  };

  const activeRows = decorated.filter(
    (s) => s.status === "open" || s.status === "under_review",
  );
  // Active sort: most-voted first, ties broken by newest.
  activeRows.sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return b.created_at.localeCompare(a.created_at);
  });
  const declinedRows = decorated.filter((s) => s.status === "declined");
  const roadmapList = decorated
    .filter((s) => ROADMAP_STATUSES.has(s.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  function canTriageFor(team: string | null): boolean {
    if (!team) return false;
    const champ = byTeam.get(team);
    return champ?.user_id === user.id;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Suggestions"
        description="Submit ideas, triage them, and promote the winners to AI initiatives."
        actions={<SubmitSuggestionDialog workflows={workflowsList} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SuggestionTabs active={tab} />
        {tab === "roadmap" && <ViewToggle active={view} />}
      </div>

      {tab === "active" && (
        <ActiveList
          rows={activeRows}
          isSuper={isSuper}
          canTriageFor={canTriageFor}
          activeInterventions={activeInterventions}
        />
      )}
      {tab === "roadmap" &&
        (view === "board" ? (
          <RoadmapBoard
            groups={roadmapGroups}
            canMove={isSuper}
            initiativeGroups={{
              up_next: initiativeRoadmapGroups.up_next.map((i) => ({
                id: i.id,
                name: i.name,
                team: null,
              })),
              in_progress: initiativeRoadmapGroups.in_progress.map((i) => ({
                id: i.id,
                name: i.name,
                team: null,
              })),
              shipped: initiativeRoadmapGroups.shipped.map((i) => ({
                id: i.id,
                name: i.name,
                team: null,
              })),
            }}
          />
        ) : (
          <ActiveList
            rows={roadmapList}
            isSuper={isSuper}
            canTriageFor={canTriageFor}
            activeInterventions={activeInterventions}
          />
        ))}
      {tab === "declined" && (
        <ActiveList
          rows={declinedRows}
          isSuper={isSuper}
          canTriageFor={canTriageFor}
          activeInterventions={activeInterventions}
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
}: {
  rows: SuggestionRow[];
  isSuper: boolean;
  canTriageFor: (team: string | null) => boolean;
  activeInterventions: { id: string; name: string }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
        No suggestions yet.
      </p>
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
