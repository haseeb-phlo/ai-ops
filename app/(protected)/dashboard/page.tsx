import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { TeamTypeChart } from "./_components/team-type-chart";
import { TopInterventions } from "./_components/top-interventions";

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
};

type Link = {
  intervention_id: string;
  workflows: { id: string; team: string | null } | null;
};

type Baseline = {
  intervention_id: string;
  time_value: number | null;
  cost_value: number | null;
};

type Metric = {
  intervention_id: string;
  snapshot_date: string;
  time_value: number | null;
  cost_value: number | null;
};

function startOfMonthISO(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function endOfMonthISO(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

function gbp(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}£${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function minutes(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} min`;
}

export default async function DashboardPage() {
  await getSessionUser();
  const supabase = await createClient();

  const monthStart = startOfMonthISO();
  const monthEnd = endOfMonthISO();

  const [
    { data: interventions },
    { data: links },
    { data: baselines },
    { data: metrics },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select("id, name, type, status, attribution_confidence, owner")
      .returns<Intervention[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows(id, team)")
      .returns<Link[]>(),
    supabase
      .from("workflow_baselines")
      .select("intervention_id, time_value, cost_value")
      .returns<Baseline[]>(),
    supabase
      .from("intervention_metrics")
      .select("intervention_id, snapshot_date, time_value, cost_value")
      .order("snapshot_date", { ascending: false })
      .returns<Metric[]>(),
  ]);

  const interventionsList = interventions ?? [];
  const linksByIntervention = new Map<string, Link[]>();
  for (const l of links ?? []) {
    const arr = linksByIntervention.get(l.intervention_id) ?? [];
    arr.push(l);
    linksByIntervention.set(l.intervention_id, arr);
  }

  const baselineSums = new Map<string, { time: number; cost: number }>();
  for (const b of baselines ?? []) {
    const cur = baselineSums.get(b.intervention_id) ?? { time: 0, cost: 0 };
    cur.time += b.time_value ?? 0;
    cur.cost += b.cost_value ?? 0;
    baselineSums.set(b.intervention_id, cur);
  }

  // metrics is sorted snapshot_date desc — first non-null per intervention wins.
  const latestTime = new Map<string, Metric>();
  const latestCost = new Map<string, Metric>();
  const latestTimeThisMonth = new Map<string, Metric>();
  for (const m of metrics ?? []) {
    if (m.time_value != null && !latestTime.has(m.intervention_id)) {
      latestTime.set(m.intervention_id, m);
    }
    if (m.cost_value != null && !latestCost.has(m.intervention_id)) {
      latestCost.set(m.intervention_id, m);
    }
    if (
      m.time_value != null &&
      m.snapshot_date >= monthStart &&
      m.snapshot_date <= monthEnd &&
      !latestTimeThisMonth.has(m.intervention_id)
    ) {
      latestTimeThisMonth.set(m.intervention_id, m);
    }
  }

  type Row = {
    id: string;
    name: string;
    type: InterventionType | null;
    status: Intervention["status"];
    confidence: Confidence;
    owner: string | null;
    teams: string[];
    weightedMinutes: number | null;
    weightedGbp: number | null;
    weightedMinutesThisMonth: number | null;
    rawMinutesDelta: number | null;
    rawGbpDelta: number | null;
  };

  const rows: Row[] = interventionsList.map((iv) => {
    const confidence: Confidence = iv.attribution_confidence ?? "medium";
    const weight = CONFIDENCE_WEIGHT[confidence];
    const baseline = baselineSums.get(iv.id) ?? { time: 0, cost: 0 };
    const lt = latestTime.get(iv.id);
    const lc = latestCost.get(iv.id);
    const ltm = latestTimeThisMonth.get(iv.id);

    const rawMinutesDelta =
      lt && lt.time_value != null ? baseline.time - lt.time_value : null;
    const rawGbpDelta =
      lc && lc.cost_value != null ? baseline.cost - lc.cost_value : null;
    const rawMinutesThisMonth =
      ltm && ltm.time_value != null ? baseline.time - ltm.time_value : null;

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
      teams,
      weightedMinutes:
        rawMinutesDelta == null ? null : rawMinutesDelta * weight,
      weightedGbp: rawGbpDelta == null ? null : rawGbpDelta * weight,
      weightedMinutesThisMonth:
        rawMinutesThisMonth == null ? null : rawMinutesThisMonth * weight,
      rawMinutesDelta,
      rawGbpDelta,
    };
  });

  // Top stats — exclude retired (no longer running, can't claim a weekly rate).
  const liveRows = rows.filter((r) => r.status !== "retired");

  let totalMinutes = 0;
  let totalGbp = 0;
  const minutesByConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const r of liveRows) {
    if (r.weightedMinutes != null) {
      totalMinutes += r.weightedMinutes;
      minutesByConfidence[r.confidence] += Math.abs(r.weightedMinutes);
    }
    if (r.weightedGbp != null) totalGbp += r.weightedGbp;
  }
  const minutesAbsTotal =
    minutesByConfidence.high + minutesByConfidence.medium + minutesByConfidence.low;
  const minutesPct = (c: Confidence) =>
    minutesAbsTotal > 0
      ? Math.round((minutesByConfidence[c] / minutesAbsTotal) * 100)
      : 0;

  const gbpByConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const r of liveRows) {
    if (r.weightedGbp != null) {
      gbpByConfidence[r.confidence] += Math.abs(r.weightedGbp);
    }
  }
  const gbpAbsTotal =
    gbpByConfidence.high + gbpByConfidence.medium + gbpByConfidence.low;
  const gbpPct = (c: Confidence) =>
    gbpAbsTotal > 0
      ? Math.round((gbpByConfidence[c] / gbpAbsTotal) * 100)
      : 0;

  const activeCount = rows.filter((r) => r.status === "active").length;

  // Stacked-bar data: team x type, this-month measurements only.
  const teamTypeMap = new Map<string, Record<InterventionType, number>>();
  for (const r of liveRows) {
    if (r.weightedMinutesThisMonth == null || !r.type) continue;
    if (r.teams.length === 0) continue;
    const share = r.weightedMinutesThisMonth / r.teams.length;
    for (const team of r.teams) {
      const cur =
        teamTypeMap.get(team) ??
        ({
          tool: 0,
          training: 0,
          prompt: 0,
          agent: 0,
          automation: 0,
          process_change: 0,
        } as Record<InterventionType, number>);
      cur[r.type] += share;
      teamTypeMap.set(team, cur);
    }
  }
  const chartData = Array.from(teamTypeMap.entries())
    .map(([team, types]) => ({ team, ...types }))
    .sort((a, b) => {
      const ta =
        a.tool + a.training + a.prompt + a.agent + a.automation + a.process_change;
      const tb =
        b.tool + b.training + b.prompt + b.agent + b.automation + b.process_change;
      return tb - ta;
    });

  // Top 10 highest-impact (by absolute weighted minutes by default; the
  // client component lets the user re-sort).
  const topRows = rows
    .filter((r) => r.weightedMinutes != null || r.weightedGbp != null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      owner: r.owner,
      confidence: r.confidence,
      teams: r.teams,
      weightedMinutes: r.weightedMinutes,
      weightedGbp: r.weightedGbp,
      rawMinutesDelta: r.rawMinutesDelta,
      rawGbpDelta: r.rawGbpDelta,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Phlo impact
        </h1>
        <p className="text-sm text-zinc-500">
          Confidence-weighted savings across every team. Honest numbers — including
          when an intervention&apos;s done worse than the baseline.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Minutes saved / week"
          value={
            <ColouredNumber
              value={totalMinutes}
              format={(v) => minutes(Math.round(v))}
            />
          }
          caveat={`${minutesPct("high")}% high · ${minutesPct("medium")}% medium · ${minutesPct("low")}% low`}
        />
        <Stat
          label="GBP saved / week"
          value={<ColouredNumber value={totalGbp} format={gbp} />}
          caveat={`${gbpPct("high")}% high · ${gbpPct("medium")}% medium · ${gbpPct("low")}% low`}
        />
        <Stat
          label="Active interventions"
          value={
            <span className="text-3xl font-semibold tabular-nums text-zinc-900">
              {activeCount}
            </span>
          }
          caveat={`${rows.length} total logged`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
            Minutes saved this month, by team and type
          </h2>
          <p className="text-xs text-zinc-500">
            Only counts interventions with a snapshot logged this month. Confidence-weighted.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          {chartData.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-zinc-400">
              No measurements logged this month yet.
            </p>
          ) : (
            <TeamTypeChart data={chartData} />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Top 10 highest-impact interventions
        </h2>
        <TopInterventions rows={topRows} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  caveat,
}: {
  label: string;
  value: React.ReactNode;
  caveat: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="mt-1.5">{value}</div>
      <p className="mt-2 text-xs text-zinc-500">{caveat}</p>
    </div>
  );
}

function ColouredNumber({
  value,
  format,
}: {
  value: number;
  format: (v: number) => string;
}) {
  const cls =
    value < 0
      ? "text-red-700"
      : value > 0
        ? "text-zinc-900"
        : "text-zinc-500";
  return (
    <span className={`text-3xl font-semibold tabular-nums ${cls}`}>
      {format(value)}
    </span>
  );
}
