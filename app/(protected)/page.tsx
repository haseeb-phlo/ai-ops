import { Suspense } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { findChampionForPerson } from "@/lib/champions";
import { PageContainer } from "@/components/page-header";
import { RedirectToast } from "./_components/dashboard/redirect-toast";
import { ChampionsRibbon } from "./_components/dashboard/champions-ribbon";
import { NeedsAttention } from "./_components/dashboard/needs-attention";
import {
  ActivityStream,
  type StreamItem,
} from "./_components/dashboard/activity-stream";

const CONFIDENCE_WEIGHT = { high: 1.0, medium: 0.7, low: 0.4 } as const;
type Confidence = keyof typeof CONFIDENCE_WEIGHT;

type Intervention = {
  id: string;
  status: "active" | "paused" | "retired" | null;
  attribution_confidence: Confidence | null;
  recipient_emails: string[] | null;
};

type Baseline = {
  intervention_id: string;
  time_value: number | null;
  cost_value: number | null;
  revenue_value: number | null;
};

type Metric = {
  intervention_id: string;
  snapshot_date: string;
  time_value: number | null;
  cost_value: number | null;
  revenue_value: number | null;
};

type RecentIntervention = {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
};

type RegEvent = {
  id: string;
  summary: string;
  severity: "red" | "amber" | "green";
  created_at: string;
  workflow_id: string | null;
};

type RecentNote = {
  id: string;
  team: string;
  body: string;
  updated_at: string;
  target_type: "workflow" | "intervention";
  target_id: string;
};

function gbp(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtMinutes(v: number): string {
  return `${Math.round(v).toLocaleString()} min`;
}
function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

export default async function Home() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const since = sevenDaysAgoIso();
  const firstName = user.displayName.split(" ")[0];

  const champion = await findChampionForPerson({
    userId: user.id,
    displayName: user.displayName,
  });

  const [
    { data: interventions },
    { data: baselines },
    { data: metrics },
    { data: recentInterventions },
    { data: regEvents },
    { data: recentNotes },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select("id, status, attribution_confidence, recipient_emails")
      .returns<Intervention[]>(),
    supabase
      .from("workflow_baselines")
      .select("intervention_id, time_value, cost_value, revenue_value")
      .returns<Baseline[]>(),
    supabase
      .from("intervention_metrics")
      .select(
        "intervention_id, snapshot_date, time_value, cost_value, revenue_value",
      )
      .order("snapshot_date", { ascending: false })
      .returns<Metric[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentIntervention[]>(),
    supabase
      .from("regulatory_events")
      .select("id, summary, severity, created_at, workflow_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RegEvent[]>(),
    supabase
      .from("champion_notes")
      .select("id, team, body, updated_at, target_type, target_id")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(8)
      .returns<RecentNote[]>(),
  ]);

  // Headcount drives the Reach metric's "X% of company" subtitle.
  const { count: peopleCount } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true });

  const interventionsList = interventions ?? [];

  const baselineSums = new Map<
    string,
    { time: number; cost: number; revenue: number }
  >();
  for (const b of baselines ?? []) {
    const cur =
      baselineSums.get(b.intervention_id) ?? { time: 0, cost: 0, revenue: 0 };
    cur.time += b.time_value ?? 0;
    cur.cost += b.cost_value ?? 0;
    cur.revenue += b.revenue_value ?? 0;
    baselineSums.set(b.intervention_id, cur);
  }

  const latestTime = new Map<string, Metric>();
  const latestCost = new Map<string, Metric>();
  const latestRevenue = new Map<string, Metric>();
  for (const m of metrics ?? []) {
    if (m.time_value != null && !latestTime.has(m.intervention_id)) {
      latestTime.set(m.intervention_id, m);
    }
    if (m.cost_value != null && !latestCost.has(m.intervention_id)) {
      latestCost.set(m.intervention_id, m);
    }
    if (m.revenue_value != null && !latestRevenue.has(m.intervention_id)) {
      latestRevenue.set(m.intervention_id, m);
    }
  }

  let totalMinutes = 0;
  let totalGbp = 0;
  let totalRevenue = 0;
  let activeCount = 0;
  // Reach: unique people covered by any active intervention.
  const reachedEmails = new Set<string>();
  for (const iv of interventionsList) {
    if (iv.status === "active") activeCount += 1;
    if (iv.status === "active") {
      for (const raw of iv.recipient_emails ?? []) {
        const email = raw.toLowerCase().trim();
        if (email) reachedEmails.add(email);
      }
    }
    if (iv.status === "retired") continue;
    const w = CONFIDENCE_WEIGHT[iv.attribution_confidence ?? "medium"];
    const baseline =
      baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
    const lt = latestTime.get(iv.id);
    const lc = latestCost.get(iv.id);
    const lr = latestRevenue.get(iv.id);
    if (lt?.time_value != null)
      totalMinutes += (baseline.time - lt.time_value) * w;
    if (lc?.cost_value != null)
      totalGbp += (baseline.cost - lc.cost_value) * w;
    // Revenue is higher-better, so positive = uplift since baseline.
    if (lr?.revenue_value != null)
      totalRevenue += (lr.revenue_value - baseline.revenue) * w;
  }

  // Single chronological stream from the past 7 days.
  const stream: StreamItem[] = [];
  for (const iv of recentInterventions ?? []) {
    stream.push({
      kind: "intervention",
      id: iv.id,
      name: iv.name,
      status: iv.status,
      at: iv.created_at,
    });
  }
  for (const e of regEvents ?? []) {
    stream.push({
      kind: "regulatory",
      id: e.id,
      summary: e.summary,
      severity: e.severity,
      at: e.created_at,
      workflowId: e.workflow_id,
    });
  }
  for (const n of recentNotes ?? []) {
    stream.push({
      kind: "note",
      id: n.id,
      team: n.team,
      body: n.body,
      at: n.updated_at,
      target_type: n.target_type,
      target_id: n.target_id,
    });
  }
  stream.sort((a, b) => b.at.localeCompare(a.at));
  const streamTop = stream.slice(0, 10);

  // Reach: % of the company touched by an active intervention.
  const reachedCount = reachedEmails.size;
  const headcount = peopleCount ?? 0;
  const reachedPercent =
    headcount > 0 ? Math.round((reachedCount / headcount) * 100) : 0;
  const reachSubtitle =
    headcount > 0
      ? `${reachedPercent}% of ${headcount} people`
      : "No directory loaded";

  return (
    <PageContainer>
      <Suspense fallback={null}>
        <RedirectToast />
      </Suspense>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Hi {firstName} <span aria-hidden>👋</span>
        </h1>
        {champion ? (
          <p className="text-sm text-zinc-500">
            <Link
              href={`/champions/${encodeURIComponent(champion.team)}`}
              className="text-amber-700 hover:underline"
            >
              AI Champion of {champion.team}
            </Link>
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Minutes saved / week" value={fmtMinutes(totalMinutes)} />
        <Stat label="GBP saved / week" value={gbp(totalGbp)} />
        <Stat label="Revenue generated / week" value={gbp(totalRevenue)} />
        <Stat
          label="Active interventions"
          value={activeCount.toLocaleString()}
        />
        <Stat
          label="People reached"
          value={reachedCount.toLocaleString()}
          subtitle={reachSubtitle}
        />
      </section>

      <ChampionsRibbon />

      <NeedsAttention user={user} champion={champion} />

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-baseline justify-between border-b border-zinc-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
            Recent activity
          </h2>
          <span className="text-xs text-zinc-500">
            {streamTop.length === 0
              ? "Nothing new"
              : `Past 7 days · ${streamTop.length} ${streamTop.length === 1 ? "event" : "events"}`}
          </span>
        </div>
        <ActivityStream items={streamTop} />
      </section>

    </PageContainer>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">{subtitle}</p>
      )}
    </div>
  );
}
