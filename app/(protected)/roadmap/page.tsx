import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/page-header";
import type { SuggestionStatus } from "@/lib/status";
import { ROADMAP_STATUSES, compareQueueOrder } from "@/lib/roadmap";
import { RoadmapBoard, type BoardCard } from "./_components/board";
import { AddRoadmapItemDialog } from "./_components/add-dialog";

type RawSuggestion = {
  id: string;
  title: string;
  body: string;
  team: string | null;
  status: SuggestionStatus;
  intervention_id: string | null;
  queue_rank: number | null;
  created_at: string;
};

type RawInitiative = {
  id: string;
  name: string;
  status: string | null;
  shipped_at: string | null;
  owner: string | null;
  queue_rank: number | null;
  created_at: string;
};

/**
 * The company-facing "what's being built" surface: a four-lane board over
 * suggestions and AI initiatives. Items arrive here three ways - a
 * suggestion getting accepted on /suggestions (it keeps its votes and
 * comment thread), a super-admin adding one directly via the header
 * dialog, or an AI initiative being logged. Cards link to their detail
 * pages for discussion.
 */
export default async function RoadmapPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: rows },
    { data: interventions },
    { data: workflows },
    { data: workflowLinks },
  ] = await Promise.all([
    supabase
      .from("intervention_suggestions")
      .select(
        "id, title, body, team, status, intervention_id, queue_rank, created_at",
      )
      .in("status", [...ROADMAP_STATUSES])
      .returns<RawSuggestion[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status, shipped_at, owner, queue_rank, created_at")
      .order("name", { ascending: true })
      .returns<RawInitiative[]>(),
    supabase
      .from("workflows")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("suggestion_workflows")
      .select("suggestion_id, workflow_id")
      .returns<{ suggestion_id: string; workflow_id: string }[]>(),
  ]);

  const suggestions = rows ?? [];
  const interventionsList = interventions ?? [];
  const workflowsList = workflows ?? [];
  const workflowNameById = new Map(workflowsList.map((w) => [w.id, w.name]));
  const interventionNameById = new Map(
    interventionsList.map((i) => [i.id, i.name]),
  );

  // Workflow links per suggestion; only non-deleted workflows resolve to a
  // name (workflowNameById is built from the deleted_at-filtered list).
  const workflowIdsBySuggestion = new Map<string, string[]>();
  for (const link of workflowLinks ?? []) {
    const arr = workflowIdsBySuggestion.get(link.suggestion_id);
    if (arr) arr.push(link.workflow_id);
    else workflowIdsBySuggestion.set(link.suggestion_id, [link.workflow_id]);
  }

  function suggestionCard(s: RawSuggestion): BoardCard {
    const workflowIds = workflowIdsBySuggestion.get(s.id) ?? [];
    const workflowNames = workflowIds
      .map((id) => workflowNameById.get(id))
      .filter((n): n is string => !!n);
    const interventionName = s.intervention_id
      ? interventionNameById.get(s.intervention_id)
      : null;
    return {
      dragId: `suggestion:${s.id}`,
      kind: "suggestion",
      title: s.title,
      href: `/suggestions/${s.id}`,
      body: s.body,
      meta: [s.team, ...workflowNames, interventionName].filter(
        (m): m is string => !!m,
      ),
      editable: { suggestionId: s.id, workflowIds },
    };
  }

  function initiativeCard(i: RawInitiative): BoardCard {
    return {
      dragId: `initiative:${i.id}`,
      kind: "initiative",
      title: i.name,
      href: `/interventions/${i.id}`,
      meta: i.owner ? [i.owner] : [],
    };
  }

  // Initiative lane mapping:
  //   shipped_at set             -> Shipped     (live and done)
  //   paused, ranked             -> Queued      (prioritised)
  //   paused, unranked           -> Accepted    (planned / on hold)
  //   active                     -> In progress (the default)
  // Status='retired' is a separate lifecycle state (decommissioned) set via
  // the status button / edit dialog - those rows never appear on the board,
  // including previously-shipped ones (retirement takes them off the map).
  const unshipped = (i: RawInitiative) => !i.shipped_at;
  const initiativesByLane = {
    accepted: interventionsList.filter(
      (i) => unshipped(i) && i.status === "paused" && i.queue_rank === null,
    ),
    queued: interventionsList.filter(
      (i) => unshipped(i) && i.status === "paused" && i.queue_rank !== null,
    ),
    in_progress: interventionsList.filter(
      (i) => unshipped(i) && i.status === "active",
    ),
    shipped: interventionsList.filter(
      (i) => !!i.shipped_at && i.status !== "retired",
    ),
  };

  // Unordered lanes show initiatives first, then suggestions newest-first.
  // The queue interleaves both kinds in the canonical priority order shared
  // with the dashboard snapshot (compareQueueOrder).
  const newestFirst = (a: RawSuggestion, b: RawSuggestion) =>
    b.created_at.localeCompare(a.created_at);
  const suggestionsIn = (status: SuggestionStatus) =>
    suggestions.filter((s) => s.status === status);

  function unorderedLane(key: "accepted" | "in_progress" | "shipped") {
    return [
      ...initiativesByLane[key].map(initiativeCard),
      ...suggestionsIn(key).sort(newestFirst).map(suggestionCard),
    ];
  }

  const queued = [
    ...suggestionsIn("queued").map((s) => ({
      order: s,
      card: suggestionCard(s),
    })),
    ...initiativesByLane.queued.map((i) => ({
      order: i,
      card: initiativeCard(i),
    })),
  ]
    .sort((a, b) => compareQueueOrder(a.order, b.order))
    .map((x) => x.card);

  const groups = {
    accepted: unorderedLane("accepted"),
    queued,
    in_progress: unorderedLane("in_progress"),
    shipped: unorderedLane("shipped"),
  };

  const isSuper = user.role === "super_admin";

  return (
    <PageContainer>
      <PageHeader
        title="Roadmap"
        description="What's being built across the company - from committed ideas, through the prioritised queue, to shipped."
        actions={isSuper ? <AddRoadmapItemDialog workflows={workflowsList} /> : undefined}
      />
      <RoadmapBoard groups={groups} canMove={isSuper} workflows={workflowsList} />
    </PageContainer>
  );
}
