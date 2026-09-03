import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { computeGates } from "@/lib/programme/gates";
import { computeRag, type RagStatus } from "@/lib/programme/rag";
import { countOverdue } from "@/lib/programme/overdue";
import { resolveItemStates, outstandingItems, type ItemState } from "@/lib/programme/unlock";
import {
  openThroughInLondon,
  todayInLondon,
  unlockDateFor,
} from "@/lib/programme/working-days";
import { isG2Impossible, satisfiedSessionIds } from "@/lib/programme/attendance";
import { gateableContentItemIds, isAwaitingContent } from "@/lib/programme/content-readiness";
import { sweepUnreviewedSubmissions } from "@/lib/programme/ai-review-run";

/**
 * Nightly RAG recompute for every active cohort.
 *
 * RAG is denormalised onto programme_cohort_members because the admin heatmap
 * renders a cell per member per day - recomputing per cell would be hundreds
 * of queries. Most inputs change through the app (which recomputes inline),
 * but one changes on its own: the passage of time. An item that was merely
 * "not done yet" yesterday is overdue today, and a session slot that has now
 * passed can make G2 impossible without anyone touching anything. That is
 * what this job is for.
 *
 * Uses the service-role client: there is no user JWT on a cron request, so
 * RLS would return nothing.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE: HeadersInit = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  // Refuse to run on Preview deploys even if they somehow have CRON_SECRET -
  // a leaked preview URL shouldn't be able to rewrite production RAG.
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

  const supabase = createAdminClient();
  // This sweep runs at 06:00 UTC and days open at 07:00 London, so whether
  // the two dates differ depends on the time of year: in GMT the sweep is an
  // hour early and they differ, in BST it lands exactly on the open and they
  // agree. That used to be "differ on every run", when the open was 09:00.
  //
  // Either way the split is what makes it not matter. Unlock takes the
  // opened-through date; overdue and RAG take the calendar one. So on a BST
  // run today's freshly opened items do join the outstanding list, and
  // `countOverdue` then drops them again because it counts strictly past days
  // - nothing becomes late an hour earlier because the sweep runs early.
  const today = todayInLondon();
  const openThrough = openThroughInLondon();

  const { data: cohorts, error: cohortError } = await supabase
    .from("programme_cohorts")
    .select("id, name, start_date, track_id, session_dates")
    .in("status", ["live", "planned"])
    .returns<
      {
        id: string;
        name: string;
        start_date: string;
        track_id: string;
        session_dates: Record<string, string[]> | null;
      }[]
    >();

  if (cohortError) {
    console.error("[programme-rag] cohort read failed", cohortError.message);
    return NextResponse.json(
      { error: "Failed to load cohorts" },
      { status: 500, headers: NO_STORE },
    );
  }

  // Backstop for AI review, and it runs BEFORE the RAG loop on purpose: an
  // approval flips G3, so a submission the sweep clears has to be visible to
  // the recompute below or it waits another twenty-four hours for its effect.
  // The submit action normally schedules the review with after(), so this
  // usually finds nothing - it is here for the times the callback never ran.
  const reviewed = await sweepUnreviewedSubmissions();

  const results: { cohort: string; members: number; counts: Record<string, number> }[] = [];

  for (const cohort of cohorts ?? []) {
    const [{ data: members }, { data: items }, { data: progress }, { data: attendance }, { data: submissions }, { data: quizzes }] =
      await Promise.all([
        supabase
          .from("programme_cohort_members")
          .select("id, user_id, joined_at")
          .eq("cohort_id", cohort.id)
          .returns<{ id: string; user_id: string; joined_at: string }[]>(),
        supabase
          .from("programme_track_items")
          .select("id, type, day_index, learn_video_id, config_json")
          .eq("track_id", cohort.track_id)
          .returns<
            { id: string; type: string; day_index: number; learn_video_id: string | null; config_json: Record<string, unknown> }[]
          >(),
        supabase
          .from("programme_item_progress")
          .select("cohort_member_id, track_item_id, status")
          .returns<
            { cohort_member_id: string; track_item_id: string; status: ItemState }[]
          >(),
        supabase
          .from("programme_session_attendance")
          .select("user_id, track_item_id, status, meta_json")
          .eq("cohort_id", cohort.id)
          .returns<
            {
              user_id: string;
              track_item_id: string;
              status: "attended" | "absent" | "excused";
              meta_json: Record<string, unknown> | null;
            }[]
          >(),
        supabase
          .from("programme_submissions")
          .select("cohort_member_id, kind, signoff_status, signoff_rubric_json, superseded_by")
          .returns<
            {
              cohort_member_id: string;
              kind: string;
              signoff_status: string;
              signoff_rubric_json: Record<string, unknown> | null;
              superseded_by: string | null;
            }[]
          >(),
        supabase
          .from("programme_quiz_attempts")
          .select("cohort_member_id, track_item_id, score")
          .returns<
            { cohort_member_id: string; track_item_id: string; score: number }[]
          >(),
      ]);

    const itemList = items ?? [];
    const sessionItems = itemList.filter((i) => i.type === "session");
    const contentItemIds = gateableContentItemIds(itemList);
    const summative = itemList.find(
      (i) => i.type === "quiz" && i.config_json?.summative === true,
    );
    const summativeIds = new Set(summative ? [summative.id] : []);

    const progressByMember = new Map<string, Map<string, ItemState>>();
    for (const p of progress ?? []) {
      let map = progressByMember.get(p.cohort_member_id);
      if (!map) {
        map = new Map();
        progressByMember.set(p.cohort_member_id, map);
      }
      map.set(p.track_item_id, p.status);
    }

    const counts: Record<string, number> = { green: 0, amber: 0, red: 0 };

    for (const member of members ?? []) {
      const memberProgress = progressByMember.get(member.id) ?? new Map();
      const resolved = resolveItemStates({
        items: itemList,
        startDate: cohort.start_date,
        today: openThrough,
        hasBaseline: true,
        progressByItemId: memberProgress,
        summativeItemIds: summativeIds,
      });

      const satisfied = satisfiedSessionIds(
        (attendance ?? [])
          .filter((a) => a.user_id === member.user_id)
          .map((a) => ({
            trackItemId: a.track_item_id,
            status: a.status,
            makeUp: a.meta_json?.make_up === true,
          })),
      );

      const live = (submissions ?? []).filter(
        (s) => s.cohort_member_id === member.id && !s.superseded_by,
      );
      const scores = (quizzes ?? [])
        .filter(
          (q) => q.cohort_member_id === member.id && q.track_item_id === summative?.id,
        )
        .map((q) => q.score);

      // Gates are computed but only G2's reachability feeds RAG; the rest are
      // rendered from the admin loader. Keeping the call here means the two
      // paths can't drift on what "satisfied" means.
      computeGates({
        contentItemIds,
        completedItemIds: new Set(
          resolved.filter((r) => r.state === "complete").map((r) => r.item.id),
        ),
        sessionItemIds: sessionItems.map((i) => i.id),
        satisfiedSessionItemIds: satisfied,
        approvedSignedExamples: live.filter(
          (s) => s.kind === "signed_example" && s.signoff_status === "approved",
        ).length,
        capstoneCredits: 0,
        bestSummativeQuizScore: scores.length ? Math.max(...scores) : null,
        summativeQuizPassMark: Number(summative?.config_json?.pass_mark ?? 8),
        hasPostResponse: false,
      });

      const rag: RagStatus = computeRag({
        // Late, not merely open. The nightly sweep exists precisely because
        // the passage of time changes this number, so it is the one caller
        // that must not go back to counting everything available.
        overdueCount: countOverdue(
          outstandingItems(resolved)
            .filter((r) => !isAwaitingContent(r.item))
            .map((r) => ({ dayIndex: r.item.day_index })),
          { startDate: cohort.start_date, today },
        ),
        hasOutstandingRejection: live.some((s) => s.signoff_status === "rejected"),
        hasImpossibleGate: isG2Impossible({
          sessions: sessionItems.map((i) => ({
            trackItemId: i.id,
            slotDates: cohort.session_dates?.[i.id] ?? [],
            fallbackDate: unlockDateFor(cohort.start_date, i.day_index),
          })),
          satisfied,
          today,
        }),
        joinedOn: member.joined_at.slice(0, 10),
        cohortStartDate: cohort.start_date,
        today,
      });

      counts[rag] += 1;

      await supabase
        .from("programme_cohort_members")
        .update({ rag_status: rag, rag_computed_at: new Date().toISOString() })
        .eq("id", member.id);
    }

    results.push({
      cohort: cohort.name,
      members: (members ?? []).length,
      counts,
    });
  }

  return NextResponse.json(
    { ok: true, today, cohorts: results, reviewed },
    { headers: NO_STORE },
  );
}
