import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTeamOptions } from "@/lib/teams";
import { loadToolSuggestions } from "@/lib/tools";
import { resolveDisplayName } from "@/lib/profile";
import { canUserEditWorkflow } from "./permissions";
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
import { DismissableAlert } from "@/components/ui/dismissable-alert";
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
    { data: directoryPeople },
  ] = await Promise.all([
    supabase
      .from("workflows")
      .select(
        "id, name, team, regulatory, visibility, frequency_per_week, frequency_cadence, criticality_score, business_kpi, owner_names, tools_used, notes, created_by, created_at",
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
        "id, step_id, field, old_value, new_value, changed_by, changed_by_email, changed_at, workflow_steps(title)",
      )
      .eq("workflow_id", id)
      .order("changed_at", { ascending: false })
      .limit(20)
      .returns<
        (Omit<ActivityRevision, "step_title" | "changed_by_label"> & {
          changed_by: string | null;
          workflow_steps: { title: string } | null;
        })[]
      >(),
    // Company directory: powers the edit dialog's people picker and the
    // people-name leg of every display-name resolution on this page.
    supabase
      .from("people")
      .select("email, display_name, title, team")
      .order("display_name", { ascending: true })
      .returns<
        {
          email: string;
          display_name: string;
          title: string | null;
          team: string | null;
        }[]
      >(),
  ]);

  if (!workflow) {
    notFound();
  }

  const peopleByEmail = new Map<string, string>();
  for (const p of directoryPeople ?? []) {
    if (p.email && p.display_name) {
      peopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }
  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));

  // Resolve every user id referenced on this page (workflow creator +
  // revision actors) to a display name in one pass, via the standard
  // profile → people-directory → email chain.
  const userIds = new Set<string>();
  if (workflow.created_by) userIds.add(workflow.created_by);
  for (const r of revisions ?? []) {
    if (r.changed_by) userIds.add(r.changed_by);
  }

  const profileById = new Map<string, string | null>();
  const emailById = new Map<string, string | null>();
  if (userIds.size > 0) {
    const ids = Array.from(userIds);
    const [{ data: profiles }, { data: emails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids)
        .returns<{ user_id: string; display_name: string | null }[]>(),
      supabase.rpc("user_emails", { p_user_ids: ids }),
    ]);
    for (const p of profiles ?? []) profileById.set(p.user_id, p.display_name);
    for (const e of (emails ?? []) as {
      user_id: string;
      email: string | null;
    }[]) {
      emailById.set(e.user_id, e.email);
    }
  }

  function labelFor(
    userId: string | null,
    fallbackEmail: string | null,
  ): string | null {
    const email = (userId ? emailById.get(userId) : null) ?? fallbackEmail;
    const peopleName = email
      ? peopleByEmail.get(email.trim().toLowerCase()) ?? null
      : null;
    const resolved = resolveDisplayName(
      userId ? profileById.get(userId) : null,
      peopleName,
      email,
    );
    return resolved || null;
  }

  const loggedByLabel = labelFor(workflow.created_by, null);

  const [teams, toolSuggestions] = await Promise.all([
    loadTeamOptions(supabase, workflow.team),
    loadToolSuggestions(supabase),
  ]);

  const canEdit = canUserEditWorkflow(user, {
    created_by: workflow.created_by,
    owner_names: workflow.owner_names,
    team: workflow.team,
  });

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
      changed_by_label: labelFor(r.changed_by, r.changed_by_email),
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
          people={pickerPeople}
          canEdit={canEdit}
          canDelete={canDelete}
          loggedByLabel={loggedByLabel}
          createdAt={workflow.created_at}
          hoursPerWeek={
            metrics?.time_baseline != null ? metrics.time_baseline / 60 : null
          }
          toolSuggestions={toolSuggestions}
        />
        {stepExtractionFailed && (
          <DismissableAlert param="stepExtractionFailed" variant="warning">
            The workflow saved, but the steps couldn&apos;t be extracted
            automatically. Add them manually below.
          </DismissableAlert>
        )}
        <MetricsStrip metrics={metrics ?? null} />
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
