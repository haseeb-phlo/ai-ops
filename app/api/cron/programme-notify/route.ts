import { NextResponse, type NextRequest } from "next/server";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { appUrl } from "@/lib/app-url";
import { isAllowedEmail } from "@/lib/auth-domain";
import { resolveDisplayName } from "@/lib/profile";
import { slackEnabled } from "@/lib/slack";
import {
  finalDayDate,
  hourInLondon,
  todayInLondon,
  workingDaysBetween,
} from "@/lib/programme/working-days";
import {
  cohortCompletionText,
  cohortSummaryText,
  dayNinetyText,
  leadDigestText,
  memberReminderText,
} from "@/lib/programme/messages";
import {
  claimSend,
  firstNameOf,
  notifyChannel,
  notifyPerson,
  recordOutcome,
  type NotificationKind,
} from "@/lib/programme/notify";
import type { RagStatus } from "@/lib/programme/rag";

/**
 * Programme notifications.
 *
 * One handler, four jobs, selected by `?job=`:
 *   member_reminder   - Mondays 9am: DM anyone with outstanding items
 *   lead_digest       - Fridays: DM each lead their team plus sign-off queue
 *   day_90            - daily sweep: nudge cohorts that finished 90 days ago
 *   cohort_completion - 4pm on a cohort's final Friday: one channel post
 *                       naming everyone who finished
 *
 * One route rather than four because they share all the plumbing - auth, the
 * admin client, recipient resolution, claim-before-send - and four copies of
 * that is four places for it to drift.
 *
 * EVERY send claims first. A retried cron, a double fire, or someone hitting
 * the URL twice is a no-op rather than a second DM to a hundred people.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE: HeadersInit = { "Cache-Control": "no-store, private" };

const JOBS = [
  "member_reminder",
  "lead_digest",
  "day_90",
  "cohort_completion",
] as const;

/** London hour the end-of-programme roundup goes out. */
const COMPLETION_POST_HOUR = 16;

/** London hour the Monday member reminder goes out. */
const MEMBER_REMINDER_HOUR = 9;
type Job = (typeof JOBS)[number];

function isoWeekKey(now: Date): string {
  return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { error: "Cron is disabled on non-production deploys." },
      { status: 403, headers: NO_STORE },
    );
  }

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
  const job = searchParams.get("job") as Job | null;
  if (!job || !JOBS.includes(job)) {
    return NextResponse.json(
      { error: `job must be one of ${JOBS.join(", ")}` },
      { status: 400, headers: NO_STORE },
    );
  }
  // A dry run resolves recipients and renders the text without sending or
  // claiming, so a message can be reviewed before a hundred people get it.
  const dryRun = searchParams.get("dry") === "1";

  const supabase = createAdminClient();
  const now = new Date();
  const today = todayInLondon(now);
  const week = isoWeekKey(now);
  const url = appUrl();

  const { data: cohorts } = await supabase
    .from("programme_cohorts")
    .select("id, name, start_date, status, slack_channel, is_test")
    .in("status", ["live"])
    .returns<
      {
        id: string;
        name: string;
        start_date: string;
        status: string;
        slack_channel: string | null;
        is_test: boolean;
      }[]
    >();

  // Preview runs INCLUDED. They used to be filtered out here, which meant the
  // one cohort anybody walks before launch was the one that never sent
  // anything - so the reminders, the digest and the roundup went out for the
  // first time to a real cohort, having never been seen.
  //
  // Safe because a preview has exactly one member, its own admin, so the DMs
  // it produces go to the person testing it. Channel posts need
  // `slack_channel` set on the cohort; unset, notifyChannel no-ops.
  //
  // This is deliberately NOT the same decision as reporting, which still
  // excludes test cohorts: a preview must be able to show you what a message
  // looks like without its answers entering the numbers.
  const liveCohorts = cohorts ?? [];
  if (liveCohorts.length === 0) {
    return NextResponse.json(
      { ok: true, job, skipped: "no-live-cohorts" },
      { headers: NO_STORE },
    );
  }

  const cohortIds = liveCohorts.map((c) => c.id);

  const { data: memberRows } = await supabase
    .from("programme_cohort_members")
    .select(
      "id, cohort_id, user_id, team_lead_user_id, rag_status, notification_opt_out, completed_at",
    )
    .in("cohort_id", cohortIds)
    .returns<
      {
        id: string;
        cohort_id: string;
        user_id: string;
        team_lead_user_id: string | null;
        rag_status: RagStatus | null;
        notification_opt_out: boolean;
        completed_at: string | null;
      }[]
    >();

  const members = memberRows ?? [];
  const allUserIds = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...members
        .map((m) => m.team_lead_user_id)
        .filter((id): id is string => id !== null),
    ]),
  ];

  const [emailsResult, { data: profiles }] = await Promise.all([
    supabase.rpc("user_emails", { p_user_ids: allUserIds }),
    supabase
      .from("profiles")
      .select("user_id, display_name, slack_user_id")
      .in("user_id", allUserIds)
      .returns<
        {
          user_id: string;
          display_name: string | null;
          slack_user_id: string | null;
        }[]
      >(),
  ]);

  const emailByUserId = new Map(
    ((emailsResult.data ?? []) as { user_id: string; email: string | null }[])
      .filter((e) => e.email && isAllowedEmail(e.email))
      .map((e) => [e.user_id, e.email!]),
  );
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const recipientFor = (userId: string) => {
    const email = emailByUserId.get(userId);
    if (!email) return null;
    const profile = profileByUserId.get(userId);
    return {
      userId,
      email,
      displayName: resolveDisplayName(profile?.display_name, null, email),
      slackUserId: profile?.slack_user_id ?? null,
    };
  };

  // `preview` is only filled on a dry run. The completion roundup tags
  // real people in a public channel, so being able to read the exact text
  // before it goes is worth the extra field.
  const results: { to: string; via: string; preview?: string }[] = [];

  const send = async (args: {
    kind: NotificationKind;
    userId: string;
    periodKey: string;
    subject: string;
    text: string;
    /** Plain rendering for the email fallback, when `text` carries mentions. */
    emailText?: string;
  }) => {
    const recipient = recipientFor(args.userId);
    if (!recipient) return;
    if (dryRun) {
      results.push({ to: recipient.displayName, via: "dry-run" });
      return;
    }
    if (!(await claimSend(supabase, {
      kind: args.kind,
      userId: args.userId,
      periodKey: args.periodKey,
    }))) {
      return;
    }
    const outcome = await notifyPerson({
      supabase,
      recipient,
      subject: args.subject,
      text: args.text,
      emailText: args.emailText,
    });
    await recordOutcome(supabase, {
      kind: args.kind,
      userId: args.userId,
      periodKey: args.periodKey,
      outcome,
    });
    results.push({
      to: recipient.displayName,
      via: outcome.ok ? outcome.via : `failed:${outcome.reason}`,
    });
  };

  /* ---------------- Monday: nudge members with work open ------------- */
  if (job === "member_reminder") {
    // 9am London, on the same dual-hour trick cohort_completion uses: Vercel
    // schedules in UTC, London is UTC+1 for half the year, so the job runs on
    // both candidate hours and the wrong one returns here. The per-week claim
    // below makes the second firing a no-op in the half of the year where
    // both clear this check.
    if (hourInLondon(now) < MEMBER_REMINDER_HOUR) {
      return NextResponse.json(
        { ok: true, job, skipped: "before-4pm-london", today },
        { headers: NO_STORE },
      );
    }

    // Progress per member, to say what is actually outstanding rather than
    // just "you have things to do".
    const { data: progress } = await supabase
      .from("programme_item_progress")
      .select("cohort_member_id, track_item_id, status")
      .returns<
        { cohort_member_id: string; track_item_id: string; status: string }[]
      >();
    const { data: items } = await supabase
      .from("programme_track_items")
      .select("id, day_index, type")
      .returns<{ id: string; day_index: number; type: string }[]>();
    const { data: submissions } = await supabase
      .from("programme_submissions")
      .select("cohort_member_id, signoff_status, superseded_by")
      .returns<
        {
          cohort_member_id: string;
          signoff_status: string;
          superseded_by: string | null;
        }[]
      >();

    const dayByItem = new Map((items ?? []).map((i) => [i.id, i.day_index]));
    const doneByMember = new Map<string, Set<string>>();
    for (const p of progress ?? []) {
      if (p.status !== "complete") continue;
      const set = doneByMember.get(p.cohort_member_id) ?? new Set();
      set.add(p.track_item_id);
      doneByMember.set(p.cohort_member_id, set);
    }
    const rejectedByMember = new Set(
      (submissions ?? [])
        .filter((s) => !s.superseded_by && s.signoff_status === "rejected")
        .map((s) => s.cohort_member_id),
    );

    for (const member of members) {
      // Finished, opted out, or on track: nothing useful to say.
      if (member.completed_at || member.notification_opt_out) continue;
      if (member.rag_status === "green" && !rejectedByMember.has(member.id)) {
        continue;
      }

      const cohort = liveCohorts.find((c) => c.id === member.cohort_id)!;

      // Nothing automatic on a cohort's first day. A cohort starts on a
      // Monday and this job runs on Mondays, so day one always collides with
      // it - and the first thing a member hears from the programme should be
      // the launch message a person writes, not a nudge about work they have
      // had no time to be late for.
      //
      // Cheap in practice: on day one nobody is overdue, so almost everyone
      // is filtered out above anyway. This covers the rest.
      if (cohort.start_date === today) continue;
      const done = doneByMember.get(member.id) ?? new Set();
      const openDays = [
        ...new Set(
          (items ?? [])
            .filter(
              (i) =>
                (i.type === "video" || i.type === "use_example") &&
                !done.has(i.id) &&
                i.day_index > 0 &&
                // Only days that have actually opened.
                workingDaysBetween(cohort.start_date, today) >= i.day_index - 1,
            )
            .map((i) => dayByItem.get(i.id)!)
            .filter((d): d is number => typeof d === "number"),
        ),
      ].sort((a, b) => a - b);

      const outstanding = openDays.length;
      if (outstanding === 0 && !rejectedByMember.has(member.id)) continue;

      const recipient = recipientFor(member.user_id);
      if (!recipient) continue;

      await send({
        kind: "member_reminder",
        userId: member.user_id,
        // ISO WEEK, matching the Monday schedule. This must track the
        // cadence: keyed on the date while the job ran daily, and keyed on
        // the week now it is Mondays again. Get it wrong in either direction
        // and the claim either suppresses sends that should go or lets both
        // of the dual-hour firings through.
        periodKey: `${member.id}:${week}`,
        subject: "Your Core Programme week",
        text: memberReminderText({
          firstName: firstNameOf(recipient.displayName),
          outstandingCount: outstanding,
          openDays,
          trackUrl: `${url}/learn/track`,
          hasRejection: rejectedByMember.has(member.id),
        }),
      });
    }
  }

  /* ---------------- Friday: lead digest + cohort summary ------------- */
  if (job === "lead_digest") {
    const { data: pending } = await supabase
      .from("programme_submissions")
      .select("cohort_member_id, signoff_status, superseded_by")
      .eq("signoff_status", "pending")
      .returns<
        {
          cohort_member_id: string;
          signoff_status: string;
          superseded_by: string | null;
        }[]
      >();
    const pendingByMember = new Map<string, number>();
    for (const s of pending ?? []) {
      if (s.superseded_by) continue;
      pendingByMember.set(
        s.cohort_member_id,
        (pendingByMember.get(s.cohort_member_id) ?? 0) + 1,
      );
    }

    const byLead = new Map<string, typeof members>();
    for (const m of members) {
      if (!m.team_lead_user_id) continue;
      byLead.set(m.team_lead_user_id, [
        ...(byLead.get(m.team_lead_user_id) ?? []),
        m,
      ]);
    }

    for (const [leadUserId, led] of byLead) {
      const recipient = recipientFor(leadUserId);
      if (!recipient) continue;

      // Resolved once, rendered twice: Slack gets the mentions, the email
      // fallback gets the same people as plain names. Same list either way.
      const digest = {
        firstName: firstNameOf(recipient.displayName),
        members: led.map((m) => {
          const person = recipientFor(m.user_id);
          return {
            name: firstNameOf(person?.displayName ?? "A colleague"),
            mention: person?.slackUserId ? `<@${person.slackUserId}>` : null,
            rag: m.rag_status ?? "green",
          };
        }),
        pendingSignOffs: led.reduce(
          (n, m) => n + (pendingByMember.get(m.id) ?? 0),
          0,
        ),
        boardUrl: `${url}/learn/leads`,
      };

      await send({
        kind: "lead_digest",
        userId: leadUserId,
        periodKey: week,
        subject: "Your team's Core Programme week",
        text: leadDigestText({ ...digest, tagged: true }),
        emailText: leadDigestText({ ...digest, tagged: false }),
      });
    }

    // One summary per cohort channel.
    for (const cohort of liveCohorts) {
      if (!cohort.slack_channel) continue;
      const cohortMembers = members.filter((m) => m.cohort_id === cohort.id);
      if (cohortMembers.length === 0) continue;

      const periodKey = `summary:${cohort.id}:${week}`;
      if (dryRun) {
        results.push({ to: `#${cohort.slack_channel}`, via: "dry-run" });
        continue;
      }
      if (!(await claimSend(supabase, {
        kind: "cohort_summary",
        userId: null,
        periodKey,
        channel: cohort.slack_channel,
      }))) {
        continue;
      }

      const weekNumber =
        Math.floor(
          Math.max(0, workingDaysBetween(cohort.start_date, today)) / 5,
        ) + 1;

      const outcome = await notifyChannel({
        channel: cohort.slack_channel,
        text: cohortSummaryText({
          cohortName: cohort.name,
          weekNumber,
          completedNames: [],
          onTrack: cohortMembers.filter((m) => m.rag_status !== "red").length,
          total: cohortMembers.length,
        }),
      });
      await recordOutcome(supabase, {
        kind: "cohort_summary",
        userId: null,
        periodKey,
        outcome,
      });
      results.push({
        to: `#${cohort.slack_channel}`,
        via: outcome.ok ? outcome.via : `failed:${outcome.reason}`,
      });
    }
  }

  /* ---------------- Day 90: one nudge, ever -------------------------- */
  if (job === "day_90") {
    // Cohorts that finished 90+ days ago. Runs daily but the claim means each
    // member is nudged exactly once, whatever day it catches them.
    const { data: past } = await supabase
      .from("programme_cohorts")
      .select("id, name, start_date, is_test")
      .in("status", ["complete", "archived"])
      .returns<
        { id: string; name: string; start_date: string; is_test: boolean }[]
      >();

    // Preview runs included here too, for the same reason as the live list
    // above: every message the programme can send should be seeable in one.
    for (const cohort of past ?? []) {
      // Day 15 is 14 working days in; 90 calendar days after that.
      const endedDaysAgo = Math.floor(
        (Date.parse(`${today}T00:00:00Z`) -
          Date.parse(`${cohort.start_date}T00:00:00Z`)) /
          86_400_000,
      );
      if (endedDaysAgo < 90 + 18) continue;

      const { data: cohortMembers } = await supabase
        .from("programme_cohort_members")
        .select("id, user_id, notification_opt_out")
        .eq("cohort_id", cohort.id)
        .returns<
          { id: string; user_id: string; notification_opt_out: boolean }[]
        >();

      for (const member of cohortMembers ?? []) {
        if (member.notification_opt_out) continue;
        const recipient = recipientFor(member.user_id);
        if (!recipient) continue;
        await send({
          kind: "day_90_nudge",
          userId: member.user_id,
          // Keyed on the member, not a period: this is a one-off, forever.
          periodKey: member.id,
          subject: "Sixty seconds: what stuck?",
          text: dayNinetyText({
            firstName: firstNameOf(recipient.displayName),
            scoreUrl: `${url}/learn/track/score`,
          }),
        });
      }
    }
  }

  /* ---------------- Final Friday, 4pm: one roundup per cohort -------- */
  if (job === "cohort_completion") {
    // Vercel schedules crons in UTC and London is UTC+1 for half the year, so
    // a single fixed UTC hour would land at 4pm for only half the year. The
    // job is scheduled on BOTH candidate hours and the earlier firing does
    // nothing when it is not yet 4pm in London. In the other half of the year
    // both firings clear this check, and the claim below makes the second a
    // no-op.
    if (hourInLondon(now) < COMPLETION_POST_HOUR) {
      return NextResponse.json(
        { ok: true, job, skipped: "before-4pm-london", today },
        { headers: NO_STORE },
      );
    }

    for (const cohort of liveCohorts) {
      if (!cohort.slack_channel) continue;
      // Only on this cohort's own last day - day 15, the Friday of week 3.
      if (finalDayDate(cohort.start_date) !== today) continue;

      const finished = members
        .filter((m) => m.cohort_id === cohort.id && m.completed_at !== null)
        .flatMap((m) => {
          const recipient = recipientFor(m.user_id);
          return recipient
            ? [{ recipient, optedOut: m.notification_opt_out }]
            : [];
        });

      // Nobody got there: say nothing. A congratulation with no names is
      // worse than silence, and the people who did not finish do not need
      // that posted in their own channel.
      if (finished.length === 0) continue;

      // A tag for anyone we can ping, a plain name for everyone else. TWO
      // reasons someone gets the name instead, and they resolve the same way:
      // no Slack account, which plenty of frontline staff do not have, or
      // they have opted out of programme notifications, and `<@id>` is a
      // notification. Neither costs them their place on the list - the credit
      // is the point of the post, the ping is not.
      const text = cohortCompletionText({
        cohortName: cohort.name,
        mentions: finished.map(({ recipient, optedOut }) =>
          recipient.slackUserId && !optedOut
            ? `<@${recipient.slackUserId}>`
            : recipient.displayName,
        ),
      });

      // Keyed on the cohort with no date: this is a one-off, forever. Even if
      // the job ran again tomorrow it would not repeat.
      const periodKey = `completion:${cohort.id}`;

      if (dryRun) {
        results.push({
          to: `#${cohort.slack_channel}`,
          via: "dry-run",
          preview: text,
        });
        continue;
      }
      if (!(await claimSend(supabase, {
        kind: "cohort_summary",
        userId: null,
        periodKey,
        channel: cohort.slack_channel,
      }))) {
        continue;
      }

      const outcome = await notifyChannel({
        channel: cohort.slack_channel,
        text,
      });
      await recordOutcome(supabase, {
        kind: "cohort_summary",
        userId: null,
        periodKey,
        outcome,
      });
      results.push({
        to: `#${cohort.slack_channel}`,
        via: outcome.ok ? outcome.via : `failed:${outcome.reason}`,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      job,
      dryRun,
      today,
      week,
      slackConfigured: slackEnabled,
      sent: results.length,
      results: results.slice(0, 60),
    },
    { headers: NO_STORE },
  );
}
