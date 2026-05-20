import { NextResponse, type NextRequest } from "next/server";
import { getISOWeek } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/app-url";
import { isAllowedEmail } from "@/lib/auth-domain";
import { isCronAuthorized, redactEmail } from "@/lib/cron-auth";
import { resolveDisplayName } from "@/lib/profile";
import {
  sendDigestEmail,
  type DigestTopWin,
  type DigestSuggestion,
  type DigestVideo,
} from "@/lib/emails/digest";

const NO_STORE: HeadersInit = { "Cache-Control": "no-store, private" };

// The cron runs weekly on Wednesdays at 07:00 UTC. Fortnightly cadence
// is achieved by gating on ISO-week parity below (only even weeks send).
// `?force=1` bypasses the parity check for manual triggers.
//
// Auth: Vercel sets `authorization: Bearer ${CRON_SECRET}` on cron-driven
// requests. We reject anything else in production. Local dev allows the
// route without auth so it can be exercised from a browser.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PERIOD_DAYS = 14;

type ProfileRow = {
  user_id: string;
  display_name: string | null;
};

type PeopleRow = { email: string; display_name: string };

type Intervention = {
  id: string;
  name: string;
  status: "active" | "paused" | "retired" | null;
  recipient_emails: string[] | null;
  created_at: string;
  created_by: string | null;
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

type Suggestion = {
  id: string;
  title: string;
  team: string | null;
  status: string;
  created_by: string | null;
};

type Vote = { suggestion_id: string; user_id: string };

type Video = {
  id: string;
  title: string;
  created_at: string;
};

type Play = { video_id: string; user_id: string };

export async function GET(request: NextRequest) {
  if (
    !isCronAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      hostHeader: request.headers.get("host"),
      expectedSecret: process.env.CRON_SECRET,
      nodeEnv: process.env.NODE_ENV,
    })
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";
  const dryRun = searchParams.get("dry") === "1";

  const now = new Date();
  const weekParityIsDigestWeek = getISOWeek(now) % 2 === 0;
  if (!force && !weekParityIsDigestWeek) {
    return NextResponse.json(
      { ok: true, skipped: "off-week", isoWeek: getISOWeek(now) },
      { headers: NO_STORE },
    );
  }

  const since = new Date(now.getTime() - PERIOD_DAYS * 86_400_000);
  const sinceIso = since.toISOString();
  const periodLabel = `${formatDate(since)} → ${formatDate(now)}`;
  const supabase = createAdminClient();

  // ----- Recipient enumeration ------------------------------------------------
  // Anyone with a profile row counts as a recipient (one is created on first
  // signup). We resolve their email via the user_emails RPC, which is
  // scoped/capped at 500 ids per call - send in batches if the org grows
  // beyond that.
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .returns<ProfileRow[]>();
  if (profileErr) {
    // Detail goes to Vercel function logs only - the response stays
    // generic so an attacker who somehow reaches this path can't
    // fingerprint the schema or RLS posture.
    console.error("[digest-cron] profiles read failed", profileErr.message);
    return NextResponse.json(
      { error: "Failed to load recipients" },
      { status: 500, headers: NO_STORE },
    );
  }
  const profileIds = (profiles ?? []).map((p) => p.user_id);
  if (profileIds.length === 0) {
    return NextResponse.json(
      { ok: true, sent: 0, skipped: "no-users" },
      { headers: NO_STORE },
    );
  }

  const emailRowsRes = await supabase.rpc("user_emails", {
    p_user_ids: profileIds,
  });
  if (emailRowsRes.error) {
    console.error(
      "[digest-cron] user_emails RPC failed",
      emailRowsRes.error.message,
    );
    return NextResponse.json(
      { error: "Failed to resolve recipient emails" },
      { status: 500, headers: NO_STORE },
    );
  }
  const emailByUserId = new Map<string, string>();
  for (const r of (emailRowsRes.data ?? []) as {
    user_id: string;
    email: string | null;
  }[]) {
    if (r.email && isAllowedEmail(r.email)) {
      emailByUserId.set(r.user_id, r.email);
    }
  }

  const { data: peopleRows } = await supabase
    .from("people")
    .select("email, display_name")
    .returns<PeopleRow[]>();
  const peopleByEmail = new Map<string, string>();
  for (const p of peopleRows ?? []) {
    if (p.email && p.display_name) {
      peopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }

  // ----- Shared content: top wins -------------------------------------------
  const [
    { data: interventions },
    { data: baselines },
    { data: metrics },
    { data: teamLinks },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select(
        "id, name, status, recipient_emails, created_at, created_by, minutes_saved_per_week, estimated_gbp_saved_per_week, estimated_revenue_per_week",
      )
      .returns<Intervention[]>(),
    supabase
      .from("workflow_baselines")
      .select("intervention_id, time_value, cost_value, revenue_value")
      .returns<Baseline[]>(),
    supabase
      .from("intervention_metrics")
      .select("intervention_id, snapshot_date, time_value, cost_value, revenue_value")
      .order("snapshot_date", { ascending: false })
      .returns<Metric[]>(),
    supabase
      .from("intervention_workflows")
      .select("intervention_id, workflows!inner(team)")
      .is("workflows.deleted_at", null)
      .returns<InterventionTeamLink[]>(),
  ]);

  const teamByInterventionId = new Map<string, string>();
  for (const link of teamLinks ?? []) {
    if (link.workflows?.team && !teamByInterventionId.has(link.intervention_id)) {
      teamByInterventionId.set(link.intervention_id, link.workflows.team);
    }
  }

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

  const url = appUrl();
  const wins: DigestTopWin[] = [];
  for (const iv of interventions ?? []) {
    if (iv.status !== "active") continue;
    const baseline =
      baselineSums.get(iv.id) ?? { time: 0, cost: 0, revenue: 0 };
    const lt = latestTime.get(iv.id);
    const lc = latestCost.get(iv.id);
    const lr = latestRevenue.get(iv.id);
    const ivMins =
      lt?.time_value != null
        ? baseline.time - lt.time_value
        : iv.minutes_saved_per_week ?? 0;
    const ivGbp =
      lc?.cost_value != null
        ? baseline.cost - lc.cost_value
        : iv.estimated_gbp_saved_per_week ?? 0;
    const ivRev =
      lr?.revenue_value != null
        ? lr.revenue_value - baseline.revenue
        : iv.estimated_revenue_per_week ?? 0;
    const weeklyGbp = ivGbp + ivRev;
    if (weeklyGbp <= 0 && ivMins <= 0) continue;
    wins.push({
      name: iv.name,
      team: teamByInterventionId.get(iv.id) ?? null,
      weeklyGbp,
      weeklyMinutes: ivMins,
      href: `${url}/interventions/${iv.id}`,
    });
  }
  const topWins = wins
    .sort(
      (a, b) =>
        b.weeklyGbp + b.weeklyMinutes / 60 - (a.weeklyGbp + a.weeklyMinutes / 60),
    )
    .slice(0, 3);

  // ----- Shared content: suggestions needing votes --------------------------
  const { data: openSuggestions } = await supabase
    .from("intervention_suggestions")
    .select("id, title, team, status, created_by")
    .in("status", ["open", "under_review"])
    .order("created_at", { ascending: false })
    .returns<Suggestion[]>();

  const suggestionIds = (openSuggestions ?? []).map((s) => s.id);
  const votesBySuggestion = new Map<string, number>();
  const votedSetByUser = new Map<string, Set<string>>();
  if (suggestionIds.length > 0) {
    const { data: voteRows } = await supabase
      .from("intervention_suggestion_votes")
      .select("suggestion_id, user_id")
      .in("suggestion_id", suggestionIds)
      .returns<Vote[]>();
    for (const v of voteRows ?? []) {
      votesBySuggestion.set(
        v.suggestion_id,
        (votesBySuggestion.get(v.suggestion_id) ?? 0) + 1,
      );
      let set = votedSetByUser.get(v.user_id);
      if (!set) {
        set = new Set();
        votedSetByUser.set(v.user_id, set);
      }
      set.add(v.suggestion_id);
    }
  }

  // ----- Shared content: videos added in window -----------------------------
  const { data: newVideos } = await supabase
    .from("learn_videos")
    .select("id, title, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .returns<Video[]>();

  const newVideoIds = (newVideos ?? []).map((v) => v.id);
  const playsByUser = new Map<string, Set<string>>();
  if (newVideoIds.length > 0) {
    const { data: playRows } = await supabase
      .from("learn_video_plays")
      .select("video_id, user_id")
      .in("video_id", newVideoIds)
      .returns<Play[]>();
    for (const p of playRows ?? []) {
      let set = playsByUser.get(p.user_id);
      if (!set) {
        set = new Set();
        playsByUser.set(p.user_id, set);
      }
      set.add(p.video_id);
    }
  }

  // ----- Per-user personal stats -------------------------------------------
  const profileNameByUserId = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    profileNameByUserId.set(p.user_id, p.display_name);
  }

  const personalByUserId = await loadPersonalStats({
    supabase,
    userIds: Array.from(emailByUserId.keys()),
    sinceIso,
  });

  // ----- Send ---------------------------------------------------------------
  const results: { email: string; status: string; detail?: string }[] = [];
  for (const [userId, email] of emailByUserId.entries()) {
    const peopleName = peopleByEmail.get(email.trim().toLowerCase()) ?? null;
    const displayName = resolveDisplayName(
      profileNameByUserId.get(userId),
      peopleName,
      email,
    );

    const userVoted = votedSetByUser.get(userId) ?? new Set();
    const suggestionsNeedingVotes: DigestSuggestion[] = (openSuggestions ?? [])
      .filter((s) => !userVoted.has(s.id) && s.created_by !== userId)
      .map((s) => ({
        title: s.title,
        team: s.team,
        voteCount: votesBySuggestion.get(s.id) ?? 0,
        href: `${url}/suggestions/${s.id}`,
      }))
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 5);

    const userPlayed = playsByUser.get(userId) ?? new Set();
    const unwatchedVideos: DigestVideo[] = (newVideos ?? [])
      .filter((v) => !userPlayed.has(v.id))
      .slice(0, 5)
      .map((v) => ({ title: v.title, href: `${url}/learn` }));

    const personal = personalByUserId.get(userId) ?? {
      initiativesShipped: 0,
      suggestionsSubmitted: 0,
      commentsPosted: 0,
      videosWatched: 0,
    };

    // Response rows carry a redacted local-part only ("ingrid.maughan@…")
    // so the body can't be turned into a directory dump if it's ever
    // intercepted, logged, or accidentally surfaced. Full sends are
    // available in Resend's dashboard.
    const redacted = redactEmail(email);

    if (dryRun) {
      results.push({ email: redacted, status: "dry-run" });
      continue;
    }

    const result = await sendDigestEmail({
      recipient: { email, displayName },
      periodLabel,
      appUrl: url,
      personal,
      topWins,
      suggestionsNeedingVotes,
      unwatchedVideos,
    });
    if ("skipped" in result) {
      results.push({ email: redacted, status: "skipped-no-resend" });
    } else if (result.ok) {
      results.push({ email: redacted, status: "sent" });
    } else {
      // Resend error messages are generic enough to keep, but log the
      // full detail to function logs in case the user needs it.
      console.warn(
        `[digest-cron] send to ${email} failed: ${result.message}`,
      );
      results.push({ email: redacted, status: "failed" });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      periodLabel,
      isoWeek: getISOWeek(now),
      forced: force,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results: results.slice(0, 50),
    },
    { headers: NO_STORE },
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadPersonalStats(args: {
  supabase: ReturnType<typeof createAdminClient>;
  userIds: string[];
  sinceIso: string;
}) {
  const map = new Map<
    string,
    {
      initiativesShipped: number;
      suggestionsSubmitted: number;
      commentsPosted: number;
      videosWatched: number;
    }
  >();
  if (args.userIds.length === 0) return map;

  const [
    { data: initiatives },
    { data: suggestions },
    { data: aicComments },
    { data: iscComments },
    { data: lvComments },
    { data: plays },
  ] = await Promise.all([
    args.supabase
      .from("ai_interventions")
      .select("created_by")
      .in("created_by", args.userIds)
      .gte("created_at", args.sinceIso),
    args.supabase
      .from("intervention_suggestions")
      .select("created_by")
      .in("created_by", args.userIds)
      .gte("created_at", args.sinceIso),
    args.supabase
      .from("ai_intervention_comments")
      .select("created_by")
      .in("created_by", args.userIds)
      .gte("created_at", args.sinceIso),
    args.supabase
      .from("intervention_suggestion_comments")
      .select("created_by")
      .in("created_by", args.userIds)
      .gte("created_at", args.sinceIso),
    args.supabase
      .from("learn_video_comments")
      .select("created_by")
      .in("created_by", args.userIds)
      .gte("created_at", args.sinceIso),
    args.supabase
      .from("learn_video_plays")
      .select("user_id, video_id")
      .in("user_id", args.userIds)
      .gte("created_at", args.sinceIso),
  ]);

  const ensure = (uid: string) => {
    let v = map.get(uid);
    if (!v) {
      v = {
        initiativesShipped: 0,
        suggestionsSubmitted: 0,
        commentsPosted: 0,
        videosWatched: 0,
      };
      map.set(uid, v);
    }
    return v;
  };

  for (const r of (initiatives ?? []) as { created_by: string | null }[]) {
    if (r.created_by) ensure(r.created_by).initiativesShipped += 1;
  }
  for (const r of (suggestions ?? []) as { created_by: string | null }[]) {
    if (r.created_by) ensure(r.created_by).suggestionsSubmitted += 1;
  }
  for (const r of (aicComments ?? []) as { created_by: string | null }[]) {
    if (r.created_by) ensure(r.created_by).commentsPosted += 1;
  }
  for (const r of (iscComments ?? []) as { created_by: string | null }[]) {
    if (r.created_by) ensure(r.created_by).commentsPosted += 1;
  }
  for (const r of (lvComments ?? []) as { created_by: string | null }[]) {
    if (r.created_by) ensure(r.created_by).commentsPosted += 1;
  }

  // Videos watched: count distinct videos per user in the window so a
  // rewatch doesn't inflate the headline.
  const distinctByUser = new Map<string, Set<string>>();
  for (const p of (plays ?? []) as {
    user_id: string | null;
    video_id: string | null;
  }[]) {
    if (!p.user_id || !p.video_id) continue;
    let set = distinctByUser.get(p.user_id);
    if (!set) {
      set = new Set();
      distinctByUser.set(p.user_id, set);
    }
    set.add(p.video_id);
  }
  for (const [uid, set] of distinctByUser.entries()) {
    ensure(uid).videosWatched += set.size;
  }

  return map;
}
