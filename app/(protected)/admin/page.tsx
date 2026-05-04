import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { AdminTabs } from "./_components/admin-tabs";
import { CompanyImpact } from "./_components/company-impact";
import { ActivityFeed } from "./_components/activity-feed";
import { TopMovers } from "./_components/top-movers";
import { LeagueTable } from "./_components/league-table";
import { RegulatoryRegister } from "./_components/regulatory-register";
import { CostSummary } from "./_components/cost-summary";
import { AuditLog } from "./_components/audit-log";
import { ChampionsFreshness } from "./_components/champions-freshness";
import {
  DeletedWorkflows,
  type DeletedWorkflowRow,
} from "./_components/deleted-workflows";

const CONFIDENCE_WEIGHT = { high: 1.0, medium: 0.7, low: 0.4 } as const;
type Confidence = keyof typeof CONFIDENCE_WEIGHT;

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
  attribution_confidence: Confidence | null;
  owner: string | null;
  vendor: string | null;
  minutes_saved_per_week: number | null;
  created_at: string;
};

type Link = {
  intervention_id: string;
  workflows: { id: string; name: string; team: string | null } | null;
};

type Baseline = {
  intervention_id: string;
  time_value: number | null;
  cost_value: number | null;
};

type Metric = {
  id: string;
  intervention_id: string;
  snapshot_date: string;
  time_value: number | null;
  cost_value: number | null;
  created_at: string;
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
  active: boolean | null;
};

type WorkflowMetricsHistoryRow = {
  workflow_id: string;
  snapshot_date: string;
  metric: "time" | "cost" | "people" | "errors" | "revenue";
  value: number;
};

type Champion = {
  id: string;
  team: string;
  display_name: string;
  last_check_in: string | null;
};

export default async function AdminPage() {
  const user = await getSessionUser();

  if (user.role !== "super_admin") {
    redirect("/dashboard?toast=admin-only");
  }

  const supabase = await createClient();

  const [
    { data: interventions },
    { data: links },
    { data: baselines },
    { data: metrics },
    { data: workflows },
    { data: stepRevisions },
    { data: workflowRevisions },
    { data: regulatoryEvents },
    { data: regulatorySteps },
    { data: history },
    { data: champions },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, type, status, attribution_confidence, owner, vendor, minutes_saved_per_week, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<Intervention[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows(id, name, team)")
      .returns<Link[]>(),
    supabase
      .from("workflow_baselines")
      .select("intervention_id, time_value, cost_value")
      .returns<Baseline[]>(),
    supabase
      .from("intervention_metrics")
      .select(
        "id, intervention_id, snapshot_date, time_value, cost_value, created_at",
      )
      .order("snapshot_date", { ascending: false })
      .returns<Metric[]>(),
    supabase
      .from("workflows")
      .select("id, name, team, active")
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
      .select(
        "id, title, workflow_id, regulatory_flag, workflows(id, name, team)",
      )
      .eq("regulatory_flag", "red")
      .returns<RegulatoryStepRow[]>(),
    supabase
      .from("workflow_metrics_history")
      .select("workflow_id, snapshot_date, metric, value")
      .eq("metric", "time")
      .order("snapshot_date", { ascending: false })
      .returns<WorkflowMetricsHistoryRow[]>(),
    supabase
      .from("champions")
      .select("id, team, display_name, last_check_in")
      .order("team")
      .returns<Champion[]>(),
  ]);

  const interventionsList = interventions ?? [];
  const workflowsList = workflows ?? [];
  const workflowsById = new Map(workflowsList.map((w) => [w.id, w]));

  // Build links map.
  const linksByIntervention = new Map<string, Link[]>();
  for (const l of links ?? []) {
    const arr = linksByIntervention.get(l.intervention_id) ?? [];
    arr.push(l);
    linksByIntervention.set(l.intervention_id, arr);
  }

  // Baseline sums per intervention.
  const baselineSums = new Map<string, { time: number; cost: number }>();
  for (const b of baselines ?? []) {
    const cur = baselineSums.get(b.intervention_id) ?? { time: 0, cost: 0 };
    cur.time += b.time_value ?? 0;
    cur.cost += b.cost_value ?? 0;
    baselineSums.set(b.intervention_id, cur);
  }

  // Latest non-null time/cost per intervention.
  const latestTime = new Map<string, Metric>();
  const latestCost = new Map<string, Metric>();
  for (const m of metrics ?? []) {
    if (m.time_value != null && !latestTime.has(m.intervention_id)) {
      latestTime.set(m.intervention_id, m);
    }
    if (m.cost_value != null && !latestCost.has(m.intervention_id)) {
      latestCost.set(m.intervention_id, m);
    }
  }

  type Row = {
    id: string;
    name: string;
    type: InterventionType | null;
    status: Intervention["status"];
    confidence: Confidence;
    owner: string | null;
    vendor: string | null;
    teams: string[];
    weightedMinutes: number | null;
    weightedGbp: number | null;
    rawMinutesDelta: number | null;
    rawGbpDelta: number | null;
    minutesSavedPerWeek: number | null;
  };

  const rows: Row[] = interventionsList.map((iv) => {
    const confidence: Confidence = iv.attribution_confidence ?? "medium";
    const weight = CONFIDENCE_WEIGHT[confidence];
    const baseline = baselineSums.get(iv.id) ?? { time: 0, cost: 0 };
    const lt = latestTime.get(iv.id);
    const lc = latestCost.get(iv.id);

    const rawMinutesDelta =
      lt && lt.time_value != null ? baseline.time - lt.time_value : null;
    const rawGbpDelta =
      lc && lc.cost_value != null ? baseline.cost - lc.cost_value : null;

    const teams = (linksByIntervention.get(iv.id) ?? [])
      .map((l) => l.workflows?.team)
      .filter((t): t is string => !!t);

    return {
      id: iv.id,
      name: iv.name,
      type: iv.type,
      status: iv.status,
      confidence,
      owner: iv.owner,
      vendor: iv.vendor,
      teams,
      weightedMinutes:
        rawMinutesDelta == null ? null : rawMinutesDelta * weight,
      weightedGbp: rawGbpDelta == null ? null : rawGbpDelta * weight,
      rawMinutesDelta,
      rawGbpDelta,
      minutesSavedPerWeek: iv.minutes_saved_per_week,
    };
  });

  // Live = anything not retired (consistent with /dashboard).
  const liveRows = rows.filter((r) => r.status !== "retired");

  // ---- Company impact totals + confidence breakdown -------------------
  const minutesByConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const gbpByConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  let totalMinutes = 0;
  let totalGbp = 0;
  for (const r of liveRows) {
    if (r.weightedMinutes != null) {
      totalMinutes += r.weightedMinutes;
      minutesByConfidence[r.confidence] += r.weightedMinutes;
    }
    if (r.weightedGbp != null) {
      totalGbp += r.weightedGbp;
      gbpByConfidence[r.confidence] += r.weightedGbp;
    }
  }
  const activeCount = rows.filter((r) => r.status === "active").length;
  const countByConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const r of rows) {
    if (r.status === "active") countByConfidence[r.confidence] += 1;
  }

  // ---- Top movers (week-on-week change in time per workflow) ----------
  const historyByWorkflow = new Map<string, WorkflowMetricsHistoryRow[]>();
  for (const h of history ?? []) {
    const arr = historyByWorkflow.get(h.workflow_id) ?? [];
    arr.push(h);
    historyByWorkflow.set(h.workflow_id, arr);
  }
  type Mover = {
    workflowId: string;
    name: string;
    team: string | null;
    latest: number;
    prior: number;
    delta: number;
  };
  const movers: Mover[] = [];
  for (const [workflowId, snapshots] of historyByWorkflow) {
    if (snapshots.length < 2) continue;
    // Sorted desc above. snapshots[0] is the most recent.
    const wf = workflowsById.get(workflowId);
    if (!wf) continue;
    const latest = snapshots[0];
    // Find a snapshot at least 6 days before latest (treat as "previous week").
    const latestDate = new Date(latest.snapshot_date);
    const cutoff = new Date(latestDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    const prior = snapshots.find((s) => new Date(s.snapshot_date) <= cutoff);
    if (!prior) continue;
    movers.push({
      workflowId,
      name: wf.name,
      team: wf.team,
      latest: latest.value,
      prior: prior.value,
      delta: latest.value - prior.value,
    });
  }
  // delta < 0 == time went down == improvement.
  const improvers = [...movers]
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);
  const regressors = [...movers]
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  // ---- League table (every active intervention) ----------------------
  const leagueRows = rows
    .filter((r) => r.status === "active")
    .sort((a, b) => {
      // weighted minutes saved per week, falling back to declared minutes_saved_per_week.
      const aMin =
        a.weightedMinutes ??
        (a.minutesSavedPerWeek != null
          ? a.minutesSavedPerWeek * CONFIDENCE_WEIGHT[a.confidence]
          : 0);
      const bMin =
        b.weightedMinutes ??
        (b.minutesSavedPerWeek != null
          ? b.minutesSavedPerWeek * CONFIDENCE_WEIGHT[b.confidence]
          : 0);
      return bMin - aMin;
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      owner: r.owner,
      vendor: r.vendor,
      confidence: r.confidence,
      teams: r.teams,
      weightedMinutes: r.weightedMinutes,
      weightedGbp: r.weightedGbp,
      minutesSavedPerWeek: r.minutesSavedPerWeek,
      rawGbpDelta: r.rawGbpDelta,
    }));

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
  // Monthly AI spend = sum of cost_value snapshots, grouped by month +
  // (vendor / type / team). We include retired interventions on purpose.
  type CostBucket = {
    month: string;
    spend: number;
  };
  const monthKey = (iso: string) => iso.slice(0, 7);
  const interventionMeta = new Map(
    interventionsList.map((iv) => [
      iv.id,
      {
        type: iv.type,
        vendor: iv.vendor,
        teams: linksByIntervention.get(iv.id)?.flatMap((l) =>
          l.workflows?.team ? [l.workflows.team] : [],
        ) ?? [],
      },
    ]),
  );
  const byVendor = new Map<string, Map<string, number>>();
  const byType = new Map<string, Map<string, number>>();
  const byTeam = new Map<string, Map<string, number>>();
  for (const m of metrics ?? []) {
    if (m.cost_value == null) continue;
    const meta = interventionMeta.get(m.intervention_id);
    if (!meta) continue;
    const month = monthKey(m.snapshot_date);
    const cost = m.cost_value;
    const vendor = meta.vendor ?? "(unspecified)";
    const type = meta.type ?? "(untyped)";

    const vMap = byVendor.get(vendor) ?? new Map();
    vMap.set(month, (vMap.get(month) ?? 0) + cost);
    byVendor.set(vendor, vMap);

    const tMap = byType.get(type) ?? new Map();
    tMap.set(month, (tMap.get(month) ?? 0) + cost);
    byType.set(type, tMap);

    if (meta.teams.length === 0) {
      const teamKey = "(no team)";
      const teMap = byTeam.get(teamKey) ?? new Map();
      teMap.set(month, (teMap.get(month) ?? 0) + cost);
      byTeam.set(teamKey, teMap);
    } else {
      const share = cost / meta.teams.length;
      for (const team of meta.teams) {
        const teMap = byTeam.get(team) ?? new Map();
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

  // ---- Audit log (workflow_revisions + step_revisions + intervention status) ----
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
  // Intervention status "changes" - we don't have a status_history table, so
  // we surface non-active interventions as one entry each (their created_at
  // is their best-known timestamp). This is honest about a known schema gap.
  const interventionsByName = new Map(
    interventionsList.map((iv) => [iv.id, iv]),
  );
  for (const iv of interventionsList) {
    if (iv.status && iv.status !== "active") {
      audit.push({
        id: `iv:${iv.id}`,
        when: iv.created_at,
        who: iv.owner ?? "(unknown)",
        kind: "intervention",
        target: interventionsByName.get(iv.id)?.name ?? iv.name,
        field: "status",
        oldValue: "active",
        newValue: iv.status,
      });
    }
  }
  audit.sort((a, b) => b.when.localeCompare(a.when));
  const auditTop100 = audit.slice(0, 100);

  // ---- Champions freshness -------------------------------------------
  // (Traffic lights computed inside the component - Date.now() is impure
  // and React 19's purity lint rule rejects it in server-render code.)
  const championRows = (champions ?? []).map((c) => ({
    id: c.id,
    team: c.team,
    displayName: c.display_name,
    lastCheckIn: c.last_check_in,
  }));

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

  let emailByUserId = new Map<string, string>();
  if (deletedUserIds.length > 0) {
    const { data: deleterProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", deletedUserIds)
      .returns<{ user_id: string; display_name: string | null }[]>();
    emailByUserId = new Map(
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
      deleted_by_email: r.deleted_by ? emailByUserId.get(r.deleted_by) ?? null : null,
    }),
  );

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Admin
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-800 ring-1 ring-inset ring-purple-200">
              super admin
            </span>
          </span>
        }
        description="Cross-company state, including failed and retired interventions."
      />


      <AdminTabs
        impact={
          <CompanyImpact
            totalMinutes={totalMinutes}
            totalGbp={totalGbp}
            activeCount={activeCount}
            minutesByConfidence={minutesByConfidence}
            gbpByConfidence={gbpByConfidence}
            countByConfidence={countByConfidence}
          />
        }
        activity={<ActivityFeed />}
        topMovers={<TopMovers improvers={improvers} regressors={regressors} />}
        league={<LeagueTable rows={leagueRows} />}
        regulatory={
          <RegulatoryRegister
            steps={regulatoryStepsList}
            unresolvedCount={unresolvedCount}
            events={regulatoryEventsList}
          />
        }
        cost={<CostSummary cost={cost} />}
        audit={<AuditLog rows={auditTop100} />}
        champions={<ChampionsFreshness rows={championRows} />}
        deleted={<DeletedWorkflows rows={deletedWorkflowRows} />}
      />
    </PageContainer>
  );
}
