import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/page-header";
import type { SuggestionStatus } from "@/lib/status";
import { ROADMAP_STATUSES, compareQueueOrder } from "@/lib/roadmap";
import { RoadmapBoard, type RoadmapCard } from "./_components/board";
import { AddRoadmapItemDialog } from "./_components/add-dialog";

type RawSuggestion = {
  id: string;
  title: string;
  body: string;
  workflow_id: string | null;
  team: string | null;
  status: SuggestionStatus;
  intervention_id: string | null;
  queue_rank: number | null;
  created_at: string;
};

/**
 * The company-facing "what's being built" surface: a four-lane board over
 * accepted/queued/in_progress/shipped suggestions plus AI initiatives.
 * Items arrive here two ways - a suggestion getting accepted on
 * /suggestions (it keeps its votes and comment thread), or a super-admin
 * adding one directly via the header dialog. Cards link back to the
 * suggestion detail page for discussion.
 */
export default async function RoadmapPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [{ data: rows }, { data: interventions }, { data: workflows }] =
    await Promise.all([
      supabase
        .from("intervention_suggestions")
        .select(
          "id, title, body, workflow_id, team, status, intervention_id, queue_rank, created_at",
        )
        .in("status", [...ROADMAP_STATUSES])
        .returns<RawSuggestion[]>(),
      supabase
        .from("ai_interventions")
        .select("id, name, status, shipped_at, owner")
        .order("name", { ascending: true })
        .returns<
          {
            id: string;
            name: string;
            status: string | null;
            shipped_at: string | null;
            owner: string | null;
          }[]
        >(),
      supabase
        .from("workflows")
        .select("id, name")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .returns<{ id: string; name: string }[]>(),
    ]);

  const suggestions = rows ?? [];
  const interventionsList = interventions ?? [];
  const workflowsList = workflows ?? [];
  const workflowNameById = new Map(workflowsList.map((w) => [w.id, w.name]));
  const interventionNameById = new Map(
    interventionsList.map((i) => [i.id, i.name]),
  );

  function toCard(s: RawSuggestion): RoadmapCard {
    return {
      id: s.id,
      title: s.title,
      body: s.body,
      team: s.team,
      workflow_id: s.workflow_id,
      workflow_name: s.workflow_id
        ? workflowNameById.get(s.workflow_id) ?? null
        : null,
      intervention_id: s.intervention_id,
      intervention_name: s.intervention_id
        ? interventionNameById.get(s.intervention_id) ?? null
        : null,
    };
  }

  // Unordered lanes read newest-first; the queue reads by the canonical
  // priority order shared with the dashboard snapshot (compareQueueOrder).
  const newestFirst = (a: RawSuggestion, b: RawSuggestion) =>
    b.created_at.localeCompare(a.created_at);
  const inStatus = (status: SuggestionStatus) =>
    suggestions.filter((s) => s.status === status);

  const groups = {
    accepted: inStatus("accepted").sort(newestFirst).map(toCard),
    queued: inStatus("queued").sort(compareQueueOrder).map(toCard),
    in_progress: inStatus("in_progress").sort(newestFirst).map(toCard),
    shipped: inStatus("shipped").sort(newestFirst).map(toCard),
  };

  // Initiative lane mapping is 2D over status + shipped_at:
  //   shipped_at set                  -> "Shipped"     (live and done)
  //   shipped_at null + status paused -> "Accepted"    (planned / on hold)
  //   shipped_at null + status active -> "In progress" (the default)
  // Status='retired' is a separate lifecycle state (decommissioned) set via
  // the status button / edit dialog - those rows don't appear on the board,
  // including previously-shipped ones (retirement takes them off the map).
  const toInitiative = (i: (typeof interventionsList)[number]) => ({
    id: i.id,
    name: i.name,
    owner: i.owner,
  });
  const initiativeGroups = {
    accepted: interventionsList
      .filter((i) => !i.shipped_at && i.status === "paused")
      .map(toInitiative),
    in_progress: interventionsList
      .filter((i) => !i.shipped_at && i.status === "active")
      .map(toInitiative),
    shipped: interventionsList
      .filter((i) => !!i.shipped_at && i.status !== "retired")
      .map(toInitiative),
  };

  const isSuper = user.role === "super_admin";

  return (
    <PageContainer>
      <PageHeader
        title="Roadmap"
        description="What's being built across the company — from committed ideas, through the prioritised queue, to shipped."
        actions={isSuper ? <AddRoadmapItemDialog workflows={workflowsList} /> : undefined}
      />
      <RoadmapBoard
        groups={groups}
        canMove={isSuper}
        initiativeGroups={initiativeGroups}
      />
    </PageContainer>
  );
}
