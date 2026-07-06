import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
import { gbp, fmtMinutes } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { RedirectToast } from "./_components/dashboard/redirect-toast";
import { TrendStrip } from "./_components/dashboard/trend-strip";
import { TopWins, type Win } from "./_components/dashboard/top-wins";
import { AllTimeRail } from "./_components/dashboard/all-time-rail";
import {
  ActivityStream,
  type StreamItem,
} from "./_components/dashboard/activity-stream";

// Attribution confidence is no longer applied to dashboard math - it stays
// on each AI initiative as an editorial signal for reviewers, but the
// headline tiles, trend strip, and Top Wins all sum the raw run-rate.
type Intervention = {
  id: string;
  name: string;
  status: "active" | "paused" | "retired" | null;
  adoption_status: "daily" | "weekly" | "occasional" | "abandoned" | null;
  recipient_emails: string[] | null;
  created_at: string;
  minutes_saved_per_week: number | null;
  estimated_gbp_saved_per_week: number | null;
  estimated_revenue_per_week: number | null;
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
  created_by: string | null;
};

type RegEvent = {
  id: string;
  summary: string;
  severity: "red" | "amber" | "green";
  created_at: string;
  workflow_id: string | null;
  created_by: string | null;
};

type RecentWorkflow = {
  id: string;
  name: string;
  team: string | null;
  created_at: string;
  created_by: string | null;
};

type RecentSuggestion = {
  id: string;
  title: string;
  body: string;
  team: string | null;
  created_by: string | null;
  created_at: string;
};

type RecentSuggestionComment = {
  id: string;
  suggestion_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  suggestion: { title: string } | null;
};

type RecentLearnVideo = {
  id: string;
  title: string;
  added_by: string | null;
  created_at: string;
};

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

/**
 * Per-week impact for one intervention as of a given date (or "now" when
 * omitted): prefer the metric-vs-baseline delta once a snapshot has been
 * logged; until then fall back to the at-log estimate so a freshly entered
 * initiative banks against its projected weekly run-rate immediately.
 * Revenue is higher-better, so positive = uplift since baseline.
 *
 * This is the single source of "current weekly impact" - the headline stat
 * tiles AND every trend-strip point run through it, so the two surfaces can
 * never disagree about the same label.
 */
function weeklyImpact(
  iv: Intervention,
  baseline: { time: number; cost: number; revenue: number },
  ivMetrics: Metric[] | undefined,
  asOfIso?: string,
): { minutes: number; gbp: number; revenue: number } {
  // ivMetrics is newest-first; find the latest snapshot per field at or
  // before the as-of date.
  let lt: Metric | undefined;
  let lc: Metric | undefined;
  let lr: Metric | undefined;
  for (const m of ivMetrics ?? []) {
    if (asOfIso && m.snapshot_date > asOfIso) continue;
    if (!lt && m.time_value != null) lt = m;
    if (!lc && m.cost_value != null) lc = m;
    if (!lr && m.revenue_value != null) lr = m;
    if (lt && lc && lr) break;
  }
  // The estimate fallback only applies once the initiative existed at the
  // as-of date - otherwise historical trend points would back-fill impact
  // from before the initiative was logged.
  const existed = !asOfIso || iv.created_at.slice(0, 10) <= asOfIso;
  return {
    minutes:
      lt?.time_value != null
        ? baseline.time - lt.time_value
        : existed
          ? iv.minutes_saved_per_week ?? 0
          : 0,
    gbp:
      lc?.cost_value != null
        ? baseline.cost - lc.cost_value
        : existed
          ? iv.estimated_gbp_saved_per_week ?? 0
          : 0,
    revenue:
      lr?.revenue_value != null
        ? lr.revenue_value - baseline.revenue
        : existed
          ? iv.estimated_revenue_per_week ?? 0
          : 0,
  };
}

export default async function Home() {
  const user = await getSessionUser();
  const supabase = await createClient();
  const since = sevenDaysAgoIso();
  const firstName = user.displayName.split(" ")[0];

  const [
    { data: interventions },
    { data: baselines },
    { data: metrics },
    { data: recentInterventions },
    { data: regEvents },
    { data: recentWorkflows },
    { data: recentSuggestions },
    { data: recentSuggestionComments },
    { data: recentLearnVideos },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, status, adoption_status, recipient_emails, created_at, minutes_saved_per_week, estimated_gbp_saved_per_week, estimated_revenue_per_week",
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
      // Safety cap only - newest-first ordering means the rows we'd drop at
      // this ceiling are ancient snapshots that no tile or trend point reads.
      .limit(5000)
      .returns<Metric[]>(),
    supabase
      .from("ai_interventions")
      .select("id, name, status, created_at, created_by")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentIntervention[]>(),
    supabase
      .from("regulatory_events")
      .select("id, summary, severity, created_at, workflow_id, created_by")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RegEvent[]>(),
    supabase
      .from("workflows")
      .select("id, name, team, created_at, created_by")
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentWorkflow[]>(),
    supabase
      .from("intervention_suggestions")
      .select("id, title, body, team, created_by, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentSuggestion[]>(),
    supabase
      .from("intervention_suggestion_comments")
      .select(
        "id, suggestion_id, body, created_by, created_at, suggestion:intervention_suggestions!inner(title)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentSuggestionComment[]>(),
    supabase
      .from("learn_videos")
      .select("id, title, added_by, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<RecentLearnVideo[]>(),
  ]);

  // Collect every user_id that drives a "by Name" attribution in the
  // activity stream, then resolve emails in a single scoped RPC. The RPC
  // requires an explicit list of user_ids so any one caller can only
  // enumerate names it has already proven access to. Profiles are fetched
  // for exactly these ids (not the whole table); the people directory read
  // keeps a whole-table scan (email casing in the directory may not match
  // auth emails, so an .in() filter could silently drop matches) but is
  // capped well above any realistic company size.
  const streamUserIds = Array.from(
    new Set(
      [
        ...((recentInterventions ?? []).map((i) => i.created_by)),
        ...((regEvents ?? []).map((e) => e.created_by)),
        ...((recentWorkflows ?? []).map((w) => w.created_by)),
        ...((recentSuggestions ?? []).map((s) => s.created_by)),
        ...((recentSuggestionComments ?? []).map((c) => c.created_by)),
        ...((recentLearnVideos ?? []).map((v) => v.added_by)),
      ].filter((v): v is string => !!v),
    ),
  );
  const [{ data: streamEmailRows }, { data: streamProfileRows }, { data: streamPeopleRows }] =
    await Promise.all([
      streamUserIds.length === 0
        ? { data: [] as { user_id: string; email: string | null }[] }
        : supabase.rpc("user_emails", { p_user_ids: streamUserIds }),
      streamUserIds.length === 0
        ? { data: [] as { user_id: string; display_name: string | null }[] }
        : supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", streamUserIds)
            .returns<{ user_id: string; display_name: string | null }[]>(),
      supabase
        .from("people")
        .select("email, display_name")
        .limit(2000)
        .returns<{ email: string; display_name: string }[]>(),
    ]);

  // Headcount drives the Reach metric's "X% of company" subtitle.
  const { count: peopleCount } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true });

  // Per-intervention team lookup so the Top wins rail can attribute each
  // win to a team. An intervention can affect multiple workflows on
  // different teams - use the first linked team's name as the label.
  // Soft-deleted workflows are excluded so retired-workflow teams don't
  // linger on the wins rail.
  const { data: teamLinks } = await supabase
    .from("intervention_workflows")
    .select("intervention_id, workflows!inner(team)")
    .is("workflows.deleted_at", null)
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

  // Pre-bucket metrics by intervention so per-intervention lookups don't
  // re-scan the full metrics array. Source query orders by snapshot_date
  // desc, so each per-intervention slice is already newest-first (which
  // weeklyImpact relies on).
  const metricsByIntervention = new Map<string, Metric[]>();
  for (const m of metrics ?? []) {
    const arr = metricsByIntervention.get(m.intervention_id);
    if (arr) arr.push(m);
    else metricsByIntervention.set(m.intervention_id, [m]);
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
    const baseline =
      baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
    // No confidence weighting - the raw number is what we report.
    const impact = weeklyImpact(
      iv,
      baseline,
      metricsByIntervention.get(iv.id),
    );
    const ivMins = impact.minutes;
    const ivGbp = impact.gbp;
    const ivRev = impact.revenue;

    // All-time projection multiplies the per-week run-rate by weeks since
    // the initiative was logged. Step up in whole weeks so a freshly
    // logged 60 min/wk initiative reads 60 min in week 1, 120 in week 2.
    const rawMinsPerWeek = ivMins;
    const rawGbpPerWeek = ivGbp;
    const rawRevPerWeek = ivRev;
    const weeksElapsed = Math.max(
      0,
      (renderNow - new Date(iv.created_at).getTime()) / (7 * 86_400_000),
    );
    const weekNumber = Math.max(1, Math.floor(weeksElapsed) + 1);
    allTimeMinutes += rawMinsPerWeek * weekNumber;
    allTimeGbp += rawGbpPerWeek * weekNumber;
    allTimeRevenue += rawRevPerWeek * weekNumber;
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

  // Trend buckets: 13 weekly snapshots covering the last 12 weeks. Each
  // point runs the SAME weeklyImpact computation as the headline tiles
  // (metric-vs-baseline once measured, at-log estimate until then), just
  // capped at "as of this week-end" - so the trend's newest point always
  // matches the tiles exactly.
  function totalsAsOf(asOfIso: string) {
    let mins = 0;
    let gbpAccum = 0;
    let rev = 0;
    for (const iv of interventionsList) {
      if (iv.status === "retired") continue;
      const baseline =
        baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
      const impact = weeklyImpact(
        iv,
        baseline,
        metricsByIntervention.get(iv.id),
        asOfIso,
      );
      mins += impact.minutes;
      gbpAccum += impact.gbp;
      rev += impact.revenue;
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
      label: "£ saved / week",
      points: trendPoints.map((p) => ({ date: p.date, value: p.gbp })),
      format: gbp,
    },
    {
      label: "Revenue generated / week",
      points: trendPoints.map((p) => ({ date: p.date, value: p.revenue })),
      format: gbp,
    },
  ];

  // Resolve created_by display names through the same profile -> people ->
  // email-local chain the rest of the app uses, so the stream shows
  // "Ingrid Maughan" instead of "ingrid.maughan".
  const streamProfileByUserId = new Map<string, string | null>();
  for (const p of streamProfileRows ?? []) {
    streamProfileByUserId.set(p.user_id, p.display_name);
  }
  const streamPeopleByEmail = new Map<string, string>();
  for (const p of streamPeopleRows ?? []) {
    if (p.email && p.display_name) {
      streamPeopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }
  const streamEmailByUserId = new Map<string, string | null>();
  for (const r of (streamEmailRows ?? []) as {
    user_id: string;
    email: string | null;
  }[]) {
    streamEmailByUserId.set(r.user_id, r.email);
  }
  function nameFor(userId: string | null): string | null {
    if (!userId) return null;
    const email = streamEmailByUserId.get(userId) ?? null;
    const peopleName = email
      ? streamPeopleByEmail.get(email.trim().toLowerCase()) ?? null
      : null;
    return (
      resolveDisplayName(
        streamProfileByUserId.get(userId),
        peopleName,
        email,
      ) || null
    );
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
      createdBy: nameFor(iv.created_by),
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
      createdBy: nameFor(e.created_by),
    });
  }
  for (const w of recentWorkflows ?? []) {
    stream.push({
      kind: "workflow",
      id: w.id,
      name: w.name,
      team: w.team,
      at: w.created_at,
      createdBy: nameFor(w.created_by),
    });
  }
  for (const s of recentSuggestions ?? []) {
    stream.push({
      kind: "suggestion",
      id: s.id,
      title: s.title,
      body: s.body,
      team: s.team,
      submittedBy: nameFor(s.created_by),
      at: s.created_at,
    });
  }
  for (const v of recentLearnVideos ?? []) {
    stream.push({
      kind: "learn-video",
      id: v.id,
      title: v.title,
      addedBy: nameFor(v.added_by),
      at: v.created_at,
    });
  }
  for (const c of recentSuggestionComments ?? []) {
    stream.push({
      kind: "suggestion-comment",
      id: c.id,
      suggestionId: c.suggestion_id,
      suggestionTitle: c.suggestion?.title ?? "a suggestion",
      body: c.body,
      commenter: nameFor(c.created_by),
      at: c.created_at,
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

      <PageHeader
        title={
          <>
            Hi {firstName} <span aria-hidden>👋</span>
          </>
        }
      />

      {/* 5 tiles: 2 + 2 + 1 full-width on small screens, one row of 5 on
          lg+ - no orphaned tile at any breakpoint. */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Minutes saved / week" value={fmtMinutes(totalMinutes)} />
        <Stat label="£ saved / week" value={gbp(totalGbp)} />
        <Stat label="Revenue generated / week" value={gbp(totalRevenue)} />
        <Stat
          label="People reached"
          value={reachedCount.toLocaleString()}
          subtitle={reachSubtitle}
        />
        <Stat
          label="Active AI initiatives"
          value={activeCount.toLocaleString()}
          className="col-span-2 lg:col-span-1"
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

      <section className="rounded-lg border border-border bg-background">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Recent activity
          </h2>
          {/* The stream is capped at 10, so don't present the rendered
              count as a total. */}
          <span className="text-xs text-muted-foreground">Past 7 days</span>
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
  className,
}: {
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-background p-4", className)}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{subtitle}</p>
      )}
    </div>
  );
}
