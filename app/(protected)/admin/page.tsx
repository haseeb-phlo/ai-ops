import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { AdminTabs } from "./_components/admin-tabs";
import { Logins } from "./_components/logins";
import { RegulatoryRegister } from "./_components/regulatory-register";
import { CostSummary } from "./_components/cost-summary";
import { AuditLog } from "./_components/audit-log";
import { ChampionsFreshness } from "./_components/champions-freshness";
import { ChampionsManager } from "./_components/champions-manager";
import { ViewAsSwitcher } from "../_components/view-as-switcher";
import {
  DeletedWorkflows,
  type DeletedWorkflowRow,
} from "./_components/deleted-workflows";

type InterventionType =
  | "tool"
  | "training"
  | "prompt"
  | "agent"
  | "automation"
  | "process_change";

type Intervention = {
  id: string;
  name: string;
  type: InterventionType | null;
  status: "active" | "paused" | "retired" | null;
  owner: string | null;
  vendor: string | null;
  created_at: string;
};

type LinkRow = {
  intervention_id: string;
  workflows: { id: string; name: string; team: string | null } | null;
};

type CostMetric = {
  intervention_id: string;
  snapshot_date: string;
  cost_value: number | null;
};

type StepRevisionRow = {
  id: string;
  workflow_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_at: string;
};

type WorkflowRevisionRow = {
  id: string;
  workflow_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_at: string;
};

type RegulatoryEventRow = {
  id: string;
  workflow_id: string | null;
  step_id: string | null;
  severity: "red" | "amber" | "green";
  summary: string;
  resolved_at: string | null;
  created_at: string;
};

type RegulatoryStepRow = {
  id: string;
  title: string;
  workflow_id: string;
  regulatory_flag: "red" | "amber" | "green" | null;
  workflows: { id: string; name: string; team: string | null } | null;
};

type WorkflowRow = {
  id: string;
  name: string;
  team: string | null;
};

type Champion = {
  id: string;
  team: string;
  display_name: string;
  last_check_in: string | null;
  user_id: string | null;
};

type DirectoryPerson = {
  id: string;
  display_name: string;
  email: string;
  team: string;
};

export default async function AdminPage() {
  const user = await getSessionUser();
  if (user.role !== "super_admin") {
    redirect("/?toast=admin-only");
  }

  const supabase = await createClient();

  const [
    { data: interventions },
    { data: links },
    { data: costMetrics },
    { data: workflows },
    { data: stepRevisions },
    { data: workflowRevisions },
    { data: regulatoryEvents },
    { data: regulatorySteps },
    { data: champions },
    { data: directoryPeople },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select("id, name, type, status, owner, vendor, created_at")
      .order("created_at", { ascending: false })
      .returns<Intervention[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows(id, name, team)")
      .returns<LinkRow[]>(),
    supabase
      .from("intervention_metrics")
      .select("intervention_id, snapshot_date, cost_value")
      .order("snapshot_date", { ascending: false })
      .returns<CostMetric[]>(),
    supabase
      .from("workflows")
      .select("id, name, team")
      .is("deleted_at", null)
      .returns<WorkflowRow[]>(),
    supabase
      .from("step_revisions")
      .select(
        "id, workflow_id, field, old_value, new_value, changed_by_email, changed_at",
      )
      .order("changed_at", { ascending: false })
      .limit(100)
      .returns<StepRevisionRow[]>(),
    supabase
      .from("workflow_revisions")
      .select(
        "id, workflow_id, field, old_value, new_value, changed_by_email, changed_at",
      )
      .order("changed_at", { ascending: false })
      .limit(100)
      .returns<WorkflowRevisionRow[]>(),
    supabase
      .from("regulatory_events")
      .select(
        "id, workflow_id, step_id, severity, summary, resolved_at, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<RegulatoryEventRow[]>(),
    supabase
      .from("workflow_steps")
      .select("id, title, workflow_id, regulatory_flag, workflows(id, name, team)")
      .eq("regulatory_flag", "red")
      .returns<RegulatoryStepRow[]>(),
    supabase
      .from("champions")
      .select("id, team, display_name, last_check_in, user_id")
      .order("team")
      .returns<Champion[]>(),
    supabase
      .from("people")
      .select("id, display_name, email, team")
      .order("display_name", { ascending: true })
      .returns<DirectoryPerson[]>(),
  ]);

  const interventionsList = interventions ?? [];
  const workflowsById = new Map((workflows ?? []).map((w) => [w.id, w]));

  const linksByIntervention = new Map<string, LinkRow[]>();
  for (const l of links ?? []) {
    const arr = linksByIntervention.get(l.intervention_id) ?? [];
    arr.push(l);
    linksByIntervention.set(l.intervention_id, arr);
  }

  // ---- Regulatory register -------------------------------------------
  const regulatoryEventsList = regulatoryEvents ?? [];
  const unresolvedCount = regulatoryEventsList.filter(
    (e) => e.resolved_at == null,
  ).length;
  const regulatoryStepsList = (regulatorySteps ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    workflowId: s.workflow_id,
    workflowName: s.workflows?.name ?? "(unknown workflow)",
    team: s.workflows?.team ?? null,
  }));

  // ---- Cost summary --------------------------------------------------
  type CostBucket = { month: string; spend: number };
  const monthKey = (iso: string) => iso.slice(0, 7);
  const interventionMeta = new Map(
    interventionsList.map((iv) => [
      iv.id,
      {
        type: iv.type,
        vendor: iv.vendor,
        teams:
          linksByIntervention
            .get(iv.id)
            ?.flatMap((l) => (l.workflows?.team ? [l.workflows.team] : [])) ?? [],
      },
    ]),
  );
  const byVendor = new Map<string, Map<string, number>>();
  const byType = new Map<string, Map<string, number>>();
  const byTeam = new Map<string, Map<string, number>>();
  for (const m of costMetrics ?? []) {
    if (m.cost_value == null) continue;
    const meta = interventionMeta.get(m.intervention_id);
    if (!meta) continue;
    const month = monthKey(m.snapshot_date);
    const cost = m.cost_value;
    const vendor = meta.vendor ?? "(unspecified)";
    const type = meta.type ?? "(untyped)";

    const vMap = byVendor.get(vendor) ?? new Map<string, number>();
    vMap.set(month, (vMap.get(month) ?? 0) + cost);
    byVendor.set(vendor, vMap);

    const tMap = byType.get(type) ?? new Map<string, number>();
    tMap.set(month, (tMap.get(month) ?? 0) + cost);
    byType.set(type, tMap);

    if (meta.teams.length === 0) {
      const teMap = byTeam.get("(no team)") ?? new Map<string, number>();
      teMap.set(month, (teMap.get(month) ?? 0) + cost);
      byTeam.set("(no team)", teMap);
    } else {
      const share = cost / meta.teams.length;
      for (const team of meta.teams) {
        const teMap = byTeam.get(team) ?? new Map<string, number>();
        teMap.set(month, (teMap.get(month) ?? 0) + share);
        byTeam.set(team, teMap);
      }
    }
  }
  const flattenCost = (m: Map<string, Map<string, number>>) =>
    [...m.entries()]
      .map(([key, months]) => ({
        key,
        rows: [...months.entries()]
          .map(([month, spend]): CostBucket => ({ month, spend }))
          .sort((a, b) => b.month.localeCompare(a.month)),
        total: [...months.values()].reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total);

  const cost = {
    byVendor: flattenCost(byVendor),
    byType: flattenCost(byType),
    byTeam: flattenCost(byTeam),
  };

  // ---- Audit log: revisions + intervention status changes ------------
  type AuditEntry = {
    id: string;
    when: string;
    who: string;
    kind: "workflow" | "step" | "intervention";
    target: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  };
  const audit: AuditEntry[] = [];
  for (const r of workflowRevisions ?? []) {
    const wf = workflowsById.get(r.workflow_id);
    audit.push({
      id: `wr:${r.id}`,
      when: r.changed_at,
      who: r.changed_by_email ?? "(unknown)",
      kind: "workflow",
      target: wf?.name ?? "(deleted workflow)",
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
    });
  }
  for (const r of stepRevisions ?? []) {
    const wf = workflowsById.get(r.workflow_id);
    audit.push({
      id: `sr:${r.id}`,
      when: r.changed_at,
      who: r.changed_by_email ?? "(unknown)",
      kind: "step",
      target: wf?.name ?? "(deleted workflow)",
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
    });
  }
  for (const iv of interventionsList) {
    if (iv.status && iv.status !== "active") {
      audit.push({
        id: `iv:${iv.id}`,
        when: iv.created_at,
        who: iv.owner ?? "(unknown)",
        kind: "intervention",
        target: iv.name,
        field: "status",
        oldValue: "active",
        newValue: iv.status,
      });
    }
  }
  audit.sort((a, b) => b.when.localeCompare(a.when));
  const auditTop100 = audit.slice(0, 100);

  // ---- Champions -----------------------------------------------------
  const championRows = (champions ?? []).map((c) => ({
    id: c.id,
    team: c.team,
    displayName: c.display_name,
    lastCheckIn: c.last_check_in,
  }));
  const managerExisting = (champions ?? []).map((c) => ({
    id: c.id,
    team: c.team,
    display_name: c.display_name,
    user_id: c.user_id,
  }));
  const teamsForManager = Array.from(
    new Set([
      ...(directoryPeople ?? []).map((p) => p.team),
      ...(champions ?? []).map((c) => c.team),
    ]),
  )
    .filter(Boolean)
    .sort();

  // ---- Deleted workflows ---------------------------------------------
  type DeletedRow = {
    id: string;
    name: string;
    team: string | null;
    deleted_at: string;
    deleted_by: string | null;
  };
  const { data: deletedRowsRaw } = await supabase
    .from("workflows")
    .select("id, name, team, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<DeletedRow[]>();

  const deletedUserIds = Array.from(
    new Set(
      (deletedRowsRaw ?? [])
        .map((r) => r.deleted_by)
        .filter((id): id is string => !!id),
    ),
  );

  let nameByUserId = new Map<string, string>();
  if (deletedUserIds.length > 0) {
    const { data: deleterProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", deletedUserIds)
      .returns<{ user_id: string; display_name: string | null }[]>();
    nameByUserId = new Map(
      (deleterProfiles ?? []).map((p) => [
        p.user_id,
        p.display_name ?? p.user_id,
      ]),
    );
  }

  const deletedWorkflowRows: DeletedWorkflowRow[] = (deletedRowsRaw ?? []).map(
    (r) => ({
      id: r.id,
      name: r.name,
      team: r.team,
      deleted_at: r.deleted_at,
      deleted_by_email: r.deleted_by ? nameByUserId.get(r.deleted_by) ?? null : null,
    }),
  );

  // ---- View-as: full team list (any team appearing on a workflow) ------
  const viewAsTeams = Array.from(
    new Set(
      (workflows ?? [])
        .map((w) => w.team)
        .filter((t): t is string => !!t),
    ),
  ).sort();

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title="Admin"
        description="Cross-company controls. Company stats and rankings live on the home dashboard for everyone."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5">
            <ViewAsSwitcher
              role={user.role}
              team={user.team}
              isImpersonating={user.isImpersonating}
              teams={viewAsTeams}
              realRole={user.realRole}
            />
          </div>
        }
      />

      <AdminTabs
        regulatory={
          <RegulatoryRegister
            steps={regulatoryStepsList}
            unresolvedCount={unresolvedCount}
            events={regulatoryEventsList}
          />
        }
        cost={<CostSummary cost={cost} />}
        champions={
          <div className="space-y-4">
            <ChampionsManager
              teams={teamsForManager}
              people={directoryPeople ?? []}
              existing={managerExisting}
            />
            <ChampionsFreshness rows={championRows} />
          </div>
        }
        audit={
          <div className="space-y-6">
            <Logins />
            <AuditLog rows={auditTop100} />
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                Deleted workflows
              </h2>
              <DeletedWorkflows rows={deletedWorkflowRows} />
            </section>
          </div>
        }
      />
    </PageContainer>
  );
}
