import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Champion } from "@/lib/champions";
import type { SessionUser } from "@/lib/auth";

type Tone = "red" | "amber" | "info";

type Item = {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  href: string;
  cta: string;
  // Used only for tie-breaking; not displayed.
  weight: number;
};

type RegEvent = {
  id: string;
  summary: string;
  workflow_id: string | null;
  created_at: string;
};

type HistoryRow = {
  workflow_id: string;
  snapshot_date: string;
  metric: string;
  value: number;
};

type WorkflowRow = {
  id: string;
  name: string;
  team: string | null;
};

const DAY = 86_400_000;
const URGENCY: Record<Tone, number> = { red: 0, amber: 1, info: 2 };

/**
 * Decision-oriented "needs attention" strip. Every source is bounded by a
 * recency window so the same item doesn't haunt the dashboard for months -
 * that matters most when usage is light at the start. After their window
 * passes, items fade out and the user must go to the deep page to find them.
 *
 *   Red regulatory events ............. created in past 14d, unresolved
 *   Workflow regressions .............. >10% time-per-run growth this week
 *   Newly stale workflows ............. last snapshot 30-60d old
 *   Champion check-in nag (self only) . own last check-in 14-30d ago
 *
 * Cap 4. Sorted: red > amber > info, recency-tie-break.
 *
 * Empty state is positive ("Nothing pressing this week.") rather than
 * "no data," so a quiet first week doesn't feel broken.
 */
export async function NeedsAttention({
  user,
  champion,
}: {
  user: SessionUser;
  champion: Champion | null;
}) {
  const supabase = await createClient();
  // Single render = single request, fine to read the wall clock.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * DAY).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * DAY).toISOString().slice(0, 10);

  const [
    { data: redEvents },
    { data: history },
    { data: workflows },
  ] = await Promise.all([
    supabase
      .from("regulatory_events")
      .select("id, summary, workflow_id, created_at")
      .eq("severity", "red")
      .is("resolved_at", null)
      .gte("created_at", fourteenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<RegEvent[]>(),
    supabase
      .from("workflow_metrics_history")
      .select("workflow_id, snapshot_date, metric, value")
      .eq("metric", "time")
      .gte("snapshot_date", ninetyDaysAgo)
      .order("snapshot_date", { ascending: false })
      .returns<HistoryRow[]>(),
    supabase
      .from("workflows")
      .select("id, name, team")
      .is("deleted_at", null)
      .returns<WorkflowRow[]>(),
  ]);

  const items: Item[] = [];
  const wfById = new Map((workflows ?? []).map((w) => [w.id, w]));

  // Source 1: red regulatory events (super-admins always; everyone else only
  // for events that touch their team's workflow).
  const isSuper = user.role === "super_admin";
  for (const e of redEvents ?? []) {
    const wf = e.workflow_id ? wfById.get(e.workflow_id) : null;
    const eventOnMyTeam = wf?.team && wf.team === user.team;
    if (!isSuper && !eventOnMyTeam) continue;
    const ageDays = Math.floor(
      (now - new Date(e.created_at).getTime()) / DAY,
    );
    items.push({
      id: `reg:${e.id}`,
      tone: "red",
      title: "Red regulatory flag",
      body: e.summary,
      href: wf ? `/workflows/${wf.id}` : "/admin",
      cta: wf ? `Open ${wf.name} →` : "Open register →",
      weight: ageDays,
    });
  }

  // Source 2: workflow regressions - group history by workflow, compare past
  // 7d to prior 7d.
  const byWorkflow = new Map<string, HistoryRow[]>();
  for (const h of history ?? []) {
    const arr = byWorkflow.get(h.workflow_id) ?? [];
    arr.push(h);
    byWorkflow.set(h.workflow_id, arr);
  }
  for (const [wfId, snapshots] of byWorkflow) {
    const wf = wfById.get(wfId);
    if (!wf) continue;
    if (!isSuper && wf.team !== user.team) continue;
    // Snapshots already desc by date.
    const sevenDaysAgo = now - 7 * DAY;
    const fourteenDaysAgoMs = now - 14 * DAY;
    const past = snapshots.filter(
      (s) => new Date(s.snapshot_date).getTime() >= sevenDaysAgo,
    );
    const prior = snapshots.filter((s) => {
      const t = new Date(s.snapshot_date).getTime();
      return t < sevenDaysAgo && t >= fourteenDaysAgoMs;
    });
    if (past.length === 0 || prior.length === 0) continue;
    const pastAvg = past.reduce((s, r) => s + r.value, 0) / past.length;
    const priorAvg = prior.reduce((s, r) => s + r.value, 0) / prior.length;
    if (priorAvg <= 0) continue;
    const pct = (pastAvg - priorAvg) / priorAvg;
    if (pct >= 0.1) {
      items.push({
        id: `reg-wf:${wf.id}`,
        tone: "amber",
        title: `${wf.name} regressed this week`,
        body: `Time per run +${Math.round(pct * 100)}% vs last week (${Math.round(priorAvg)} → ${Math.round(pastAvg)} min).`,
        href: `/workflows/${wf.id}`,
        cta: "Open workflow →",
        weight: -pct, // bigger regression = higher priority within tone
      });
    }
  }

  // Source 3: newly-stale workflows - most recent snapshot is between 30 and
  // 60 days old. (Older than 60d is considered "long since stale," skipped.)
  for (const [wfId, snapshots] of byWorkflow) {
    const wf = wfById.get(wfId);
    if (!wf) continue;
    if (!isSuper && wf.team !== user.team) continue;
    const latest = snapshots[0];
    if (!latest) continue;
    const ageDays = Math.floor(
      (now - new Date(latest.snapshot_date).getTime()) / DAY,
    );
    if (ageDays >= 30 && ageDays <= 60) {
      items.push({
        id: `stale-wf:${wf.id}`,
        tone: "amber",
        title: `${wf.name} hasn't been measured in ${ageDays}d`,
        body: "Log a metric snapshot so the dashboard reflects reality.",
        href: `/workflows/${wf.id}`,
        cta: "Open workflow →",
        weight: -ageDays,
      });
    }
  }

  // Source 4: champion check-in nag - only for the user's own staleness, in a
  // tight 14-30d window so they're not nagged forever.
  if (champion?.last_check_in) {
    const ageDays = Math.floor(
      (now - new Date(champion.last_check_in).getTime()) / DAY,
    );
    if (ageDays >= 14 && ageDays <= 30) {
      items.push({
        id: `champ-stale:${champion.team}`,
        tone: "amber",
        title: `${ageDays}d since your champion check-in`,
        body: `Keep ${champion.team}'s data fresh by checking in.`,
        href: `/champions/${encodeURIComponent(champion.team)}`,
        cta: "Check in →",
        weight: -ageDays,
      });
    }
  }

  items.sort(
    (a, b) => URGENCY[a.tone] - URGENCY[b.tone] || a.weight - b.weight,
  );
  const top = items.slice(0, 4);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-zinc-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Needs attention
        </h2>
        <span className="text-xs text-zinc-500">
          {top.length === 0 ? "All clear" : `${top.length} pressing`}
        </span>
      </div>
      {top.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-400">
          Nothing pressing this week. Quiet weeks are good - log a snapshot or
          a champion note when you have one.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {top.map((it) => (
            <li key={it.id} className="px-4 py-3">
              <Link
                href={it.href}
                className="group flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${
                        it.tone === "red"
                          ? "bg-red-500"
                          : it.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-zinc-400"
                      }`}
                    />
                    <p className="truncate text-sm font-medium text-zinc-900 group-hover:underline">
                      {it.title}
                    </p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 pl-3.5 text-xs text-zinc-500">
                    {it.body}
                  </p>
                </div>
                <span className="shrink-0 self-center text-xs font-medium text-zinc-500 group-hover:text-zinc-900">
                  {it.cta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
