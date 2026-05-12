import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTeamOptions } from "@/lib/teams";
import { HeaderCard, type WorkflowHeader } from "./_components/header-card";
import {
  MetricsStrip,
  type WorkflowMetrics,
} from "./_components/metrics-strip";
import { StepsTable, type Step } from "./_components/steps-table";
import {
  LinkedInterventions,
  type LinkedIntervention,
} from "./_components/linked-interventions";
import { Activity, type ActivityRevision } from "./_components/activity";
import { ChampionNotesSection } from "@/app/(protected)/_components/champion-notes/notes-section";
import { DetailHeader } from "@/components/ui/detail-header";

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stepExtractionFailed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const stepExtractionFailed = sp.stepExtractionFailed === "1";
  const user = await getSessionUser();
  const supabase = await createClient();

  const [
    { data: workflow },
    { data: metrics },
    { data: steps },
    { data: interventionLinks },
    { data: revisions },
  ] = await Promise.all([
    supabase
      .from("workflows")
      .select(
        "id, name, team, regulatory, frequency_per_week, criticality, business_kpi, owner_names, tools_used, created_by, created_at",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle<
        WorkflowHeader & { created_by: string | null; created_at: string }
      >(),
    supabase
      .from("workflow_metrics")
      .select(
        "time_baseline, time_current, cost_baseline, cost_current, people_baseline, people_current, errors_baseline, errors_current, revenue_baseline, revenue_current",
      )
      .eq("workflow_id", id)
      .maybeSingle<NonNullable<WorkflowMetrics>>(),
    supabase
      .from("workflow_steps")
      .select("id, position, title, description, owner, duration_minutes")
      .eq("workflow_id", id)
      .order("position", { ascending: true })
      .returns<Step[]>(),
    supabase
      .from("intervention_workflows")
      .select("ai_interventions(id, name, description, status)")
      .eq("workflow_id", id)
      .returns<{ ai_interventions: LinkedIntervention | null }[]>(),
    supabase
      .from("step_revisions")
      .select(
        "id, step_id, field, old_value, new_value, changed_by_email, changed_at, workflow_steps(title)",
      )
      .eq("workflow_id", id)
      .order("changed_at", { ascending: false })
      .limit(20)
      .returns<
        (Omit<ActivityRevision, "step_title"> & {
          workflow_steps: { title: string } | null;
        })[]
      >(),
  ]);

  if (!workflow) {
    notFound();
  }

  // Resolve created_by → display name (profiles), else canonical email
  // (auth.users via user_emails RPC). Falls back to null for legacy seed
  // rows that pre-date the created_by column.
  let loggedByLabel: string | null = null;
  if (workflow.created_by) {
    const [{ data: ownerProfile }, { data: emails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", workflow.created_by)
        .maybeSingle<{ display_name: string | null }>(),
      supabase.rpc("user_emails"),
    ]);
    const dn = ownerProfile?.display_name?.trim();
    if (dn) {
      loggedByLabel = dn;
    } else {
      const emailRows = (emails ?? []) as Array<{
        user_id: string;
        email: string | null;
      }>;
      const match = emailRows.find((e) => e.user_id === workflow.created_by);
      if (match?.email) loggedByLabel = match.email;
    }
  }

  const teams = await loadTeamOptions(supabase, workflow.team);

  const canEdit =
    user.role === "super_admin" || user.team === workflow.team;

  let canDelete =
    user.role === "super_admin" || workflow.created_by === user.id;
  if (!canDelete && workflow.team) {
    const { data: championRows } = await supabase
      .from("champions")
      .select("team")
      .eq("user_id", user.id)
      .eq("team", workflow.team);
    canDelete = (championRows?.length ?? 0) > 0;
  }

  const interventions: LinkedIntervention[] =
    interventionLinks
      ?.map((row) => row.ai_interventions)
      .filter((iv): iv is LinkedIntervention => iv !== null) ?? [];

  const activity: ActivityRevision[] =
    revisions?.map((r) => ({
      id: r.id,
      step_id: r.step_id,
      field: r.field,
      old_value: r.old_value,
      new_value: r.new_value,
      changed_by_email: r.changed_by_email,
      changed_at: r.changed_at,
      step_title: r.workflow_steps?.title ?? null,
    })) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <DetailHeader
        backHref="/workflows"
        backLabel="All workflows"
        title={workflow.name}
      />
      <div className="space-y-6">
        <HeaderCard
          workflow={workflow}
          teams={teams}
          canEdit={canEdit}
          canDelete={canDelete}
          loggedByLabel={loggedByLabel}
          createdAt={workflow.created_at}
        />
        {stepExtractionFailed && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Heads up:</strong> the workflow saved, but Claude
            couldn&apos;t extract steps from your walk-through. Add steps
            manually below.
          </p>
        )}
        <MetricsStrip metrics={metrics ?? null} />
        <ChampionNotesSection
          targetType="workflow"
          targetId={workflow.id}
          relevantTeams={workflow.team ? [workflow.team] : []}
        />
        <StepsTable
          steps={steps ?? []}
          workflowId={workflow.id}
          canEdit={canEdit}
        />
        <LinkedInterventions interventions={interventions} />
        <Activity revisions={activity} />
      </div>
    </div>
  );
}
