import { Suspense } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { findChampionForPerson } from "@/lib/champions";
import { PageContainer } from "@/components/page-header";
import { RedirectToast } from "./_components/dashboard/redirect-toast";
import { ChampionsRibbon } from "./_components/dashboard/champions-ribbon";
import { TrendStrip } from "./_components/dashboard/trend-strip";
import { TopWins, type Win } from "./_components/dashboard/top-wins";
import { AllTimeRail } from "./_components/dashboard/all-time-rail";
import {
  ActivityStream,
  type StreamItem,
} from "./_components/dashboard/activity-stream";

const CONFIDENCE_WEIGHT = { high: 1.0, medium: 0.7, low: 0.4 } as const;
type Confidence = keyof typeof CONFIDENCE_WEIGHT;

type Intervention = {
  id: string;
  name: string;
  status: "active" | "paused" | "retired" | null;
  attribution_confidence: Confidence | null;
  adoption_status: "daily" | "weekly" | "occasional" | "abandoned" | null;
  recipient_emails: string[] | null;
  created_at: string;
};

type InterventionTeamLink = {
  intervention_id: string;
  workflows: { team: string | null } | null;
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
      .select(
        "id, name, status, attribution_confidence, adoption_status, recipient_emails, created_at",
      )
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

  // Per-intervention team lookup so the Top wins rail can attribute each
  // win to a team. An intervention can affect multiple workflows on
  // different teams - use the first linked team's name as the label.
  const { data: teamLinks } = await supabase
    .from("intervention_workflows")
    .select("intervention_id, workflows(team)")
    .returns<InterventionTeamLink[]>();
  const teamByInterventionId = new Map<string, string>();
  for (const link of teamLinks ?? []) {
    if (link.workflows?.team && !teamByInterventionId.has(link.intervention_id)) {
      teamByInterventionId.set(link.intervention_id, link.workflows.team);
    }
  }

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
  // All-time totals include retired interventions so the historical
  // "banked" value never drops when something is sunset - retirement
  // freezes the intervention's last-known savings level on the books.
  let allTimeMinutes = 0;
  let allTimeGbp = 0;
  let allTimeRevenue = 0;
  let allTimeInterventionCount = 0;
  let activeCount = 0;
  // Single render = single request; one wall-clock read is fine here.
  // eslint-disable-next-line react-hooks/purity
  const renderNow = Date.now();
  // Reach: unique people covered by any active intervention.
  const reachedEmails = new Set<string>();
  // Per-intervention impact, used to rank Top wins.
  const winsAccum: Win[] = [];
  for (const iv of interventionsList) {
    if (iv.status === "active") activeCount += 1;
    if (iv.status === "active") {
      for (const raw of iv.recipient_emails ?? []) {
        const email = raw.toLowerCase().trim();
        if (email) reachedEmails.add(email);
      }
    }
    const w = CONFIDENCE_WEIGHT[iv.attribution_confidence ?? "medium"];
    const baseline =
      baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
    const lt = latestTime.get(iv.id);
    const lc = latestCost.get(iv.id);
    const lr = latestRevenue.get(iv.id);
    let ivMins = 0;
    let ivGbp = 0;
    let ivRev = 0;
    if (lt?.time_value != null) ivMins = (baseline.time - lt.time_value) * w;
    if (lc?.cost_value != null) ivGbp = (baseline.cost - lc.cost_value) * w;
    // Revenue is higher-better, so positive = uplift since baseline.
    if (lr?.revenue_value != null)
      ivRev = (lr.revenue_value - baseline.revenue) * w;

    // All-time always includes the intervention - weekly rate multiplied
    // by weeks-since-creation gives a usable cumulative ("approximately
    // this much has been banked since this intervention launched"). It
    // overcounts slightly if the rate has grown since launch and undercounts
    // if it dropped, but for ROI conversations it's the right shape.
    const weeksSinceCreated = Math.max(
      0,
      (renderNow - new Date(iv.created_at).getTime()) / (7 * 86_400_000),
    );
    allTimeMinutes += ivMins * weeksSinceCreated;
    allTimeGbp += ivGbp * weeksSinceCreated;
    allTimeRevenue += ivRev * weeksSinceCreated;
    allTimeInterventionCount += 1;
    if (iv.status === "retired") continue;
    totalMinutes += ivMins;
    totalGbp += ivGbp;
    totalRevenue += ivRev;

    if (iv.status === "active" && (ivMins > 0 || ivGbp > 0 || ivRev > 0)) {
      winsAccum.push({
        id: iv.id,
        name: iv.name,
        team: teamByInterventionId.get(iv.id) ?? null,
        weeklyGbp: ivGbp + ivRev,
        weeklyMinutes: ivMins,
        recipients: (iv.recipient_emails ?? []).length,
        adoption: iv.adoption_status,
      });
    }
  }

  // Top wins: highest weighted weekly impact first. Combines £ saved +
  // revenue generated since both flow to the bottom line; minutes saved
  // is shown as a secondary signal so volunteer-time wins still surface.
  const topWins = winsAccum
    .sort((a, b) => {
      const aScore = a.weeklyGbp + a.weeklyMinutes / 60;
      const bScore = b.weeklyGbp + b.weeklyMinutes / 60;
      return bScore - aScore;
    })
    .slice(0, 5);

  // Pre-bucket metrics by intervention so each trend point doesn't re-scan
  // the full metrics array. Source query orders by snapshot_date desc, so
  // each per-intervention slice is already newest-first.
  const metricsByIntervention = new Map<string, Metric[]>();
  for (const m of metrics ?? []) {
    const arr = metricsByIntervention.get(m.intervention_id);
    if (arr) arr.push(m);
    else metricsByIntervention.set(m.intervention_id, [m]);
  }

  // Trend buckets: 13 weekly snapshots covering the last 12 weeks. For each
  // bucket we re-roll the same baseline-vs-latest math but cap the latest
  // metric at "as of this week-end" so the line shows how cumulative impact
  // moved over time, not just today's number repeated.
  function totalsAsOf(asOfIso: string) {
    let mins = 0;
    let gbpAccum = 0;
    let rev = 0;
    for (const iv of interventionsList) {
      if (iv.status === "retired") continue;
      const w = CONFIDENCE_WEIGHT[iv.attribution_confidence ?? "medium"];
      const baseline =
        baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
      const ivMetrics = metricsByIntervention.get(iv.id);
      if (!ivMetrics) continue;
      let lt: Metric | undefined;
      let lc: Metric | undefined;
      let lr: Metric | undefined;
      for (const m of ivMetrics) {
        if (m.snapshot_date > asOfIso) continue;
        if (!lt && m.time_value != null) lt = m;
        if (!lc && m.cost_value != null) lc = m;
        if (!lr && m.revenue_value != null) lr = m;
        if (lt && lc && lr) break;
      }
      if (lt?.time_value != null) mins += (baseline.time - lt.time_value) * w;
      if (lc?.cost_value != null) gbpAccum += (baseline.cost - lc.cost_value) * w;
      if (lr?.revenue_value != null) rev += (lr.revenue_value - baseline.revenue) * w;
    }
    return { minutes: mins, gbp: gbpAccum, revenue: rev };
  }

  const weekEnds: string[] = (() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 12; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i * 7);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  })();

  const trendPoints = weekEnds.map((d) => ({ date: d, ...totalsAsOf(d) }));
  const trendSeries = [
    {
      label: "Minutes saved / week",
      points: trendPoints.map((p) => ({ date: p.date, value: p.minutes })),
      format: fmtMinutes,
    },
    {
      label: "GBP saved / week",
      points: trendPoints.map((p) => ({ date: p.date, value: p.gbp })),
      format: gbp,
    },
    {
      label: "Revenue generated / week",
      points: trendPoints.map((p) => ({ date: p.date, value: p.revenue })),
      format: gbp,
    },
  ];

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
          label="People reached"
          value={reachedCount.toLocaleString()}
          subtitle={reachSubtitle}
        />
        <Stat
          label="Active AI initiatives"
          value={activeCount.toLocaleString()}
        />
      </section>

      <TrendStrip series={trendSeries} />

      <AllTimeRail
        minutes={allTimeMinutes}
        gbpSaved={allTimeGbp}
        revenue={allTimeRevenue}
        interventionCount={allTimeInterventionCount}
      />

      <TopWins wins={topWins} />

      <ChampionsRibbon />

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-baseline justify-between border-b border-zinc-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
            Recent activity
          </h2>
          <span className="text-xs text-zinc-500">
            {streamTop.length === 0
              ? "Past 7 days"
              : `Past 7 days · ${streamTop.length} ${
                  streamTop.length === 1 ? "event" : "events"
                }`}
          </span>
        </div>
        {streamTop.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-400">
            Nothing logged in the last week.
          </p>
        ) : (
          <ActivityStream items={streamTop} />
        )}
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
