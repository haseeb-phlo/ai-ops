import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeGates, g3Routes, type G3Route, type GateSet } from "./gates";
import { stepsToGreen, type StepsToGreen } from "./next-steps";
import { type DayActivity } from "./activity";
import { computeRag, type RagStatus } from "./rag";
import { countOverdue, overdueOnly } from "./overdue";
import { resolveCompletedItemIds } from "./completed-items";
import {
  resolveItemStates,
  outstandingItems,
  type ItemState,
  type ResolvedItem,
} from "./unlock";
import {
  todayInLondon,
  hasReached,
  unlockDateFor,
  weekOf,
} from "./working-days";
import { pickMembership, rankMemberships } from "./membership";
import { gateableContentItemIds, isAwaitingContent } from "./content-readiness";

/**
 * Loads everything the member's track view needs, in one place.
 *
 * Wrapped in React `cache()` so the page, the gate strip and the /learn banner
 * can each ask for it in a single render without repeating the queries -
 * the same pattern `getSessionUser` uses.
 */

export type TrackItemRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  day_index: number;
  sort_order: number;
  learn_video_id: string | null;
  config_json: Record<string, unknown>;
};

export type TrackVideo = {
  id: string;
  title: string;
  loom_embed_id: string;
  loom_share_url: string;
  thumbnail_url: string | null;
};

export type TrackState = {
  cohort: {
    id: string;
    name: string;
    startDate: string;
    status: string;
    sessionDates: Record<string, string[]>;
    /** True for a preview or rehearsal cohort, so the UI can say so. */
    isTest: boolean;
  };
  /** Other cohorts this person is in, for switching between them. */
  otherCohorts: { id: string; name: string; isTest: boolean }[];
  membership: {
    id: string;
    joinedAt: string;
    isChampion: boolean;
    completedAt: string | null;
  };
  today: string;
  hasBaseline: boolean;
  /**
   * Whether the member is past the entry gate, which is what every surface
   * should branch on rather than `hasBaseline` itself. True once the check-in
   * exists - and always true in a test cohort, where the gate has nothing to
   * measure and would only lock the sandbox shut. See unlock.ts.
   */
  entryGateOpen: boolean;
  /**
   * Week one's checkpoint - rule 2b in unlock.ts. Week two stays shut until
   * both of week one's submissions exist, and `outstanding` is what the page
   * names so the member can see the wall before walking into it.
   */
  weekOneGate: {
    satisfied: boolean;
    required: { id: string; title: string; dayIndex: number }[];
    outstanding: { id: string; title: string; dayIndex: number }[];
  };
  hasPostResponse: boolean;
  items: ResolvedItem<TrackItemRow>[];
  videosById: Map<string, TrackVideo>;
  /** Union of item_progress completions and Learn's own completion signal. */
  completedItemIds: Set<string>;
  gates: GateSet;
  rag: RagStatus;
  /** Unlocked, actionable, unfinished - however recently it opened. */
  outstandingCount: number;
  /** The subset of those whose day has already passed. Drives RAG. */
  overdueCount: number;
  /** The complete ways left to clear G3. Empty once it has passed. */
  g3Routes: G3Route[];
  /** The shortest route back to green, or none when already there. */
  nextSteps: StepsToGreen;
  /** One entry per programme day, for the activity heatmap. */
  activity: DayActivity[];
  /** Live (non-superseded) submission per submission_slot item id. */
  submissionByItemId: Map<
    string,
    {
      kind: string;
      signoffStatus: string;
      signoffComment: string | null;
      reviewedByAi: boolean;
    }
  >;
};

/**
 * The member's current programme state, or null when they aren't in a live
 * cohort (which is most people until they're enrolled).
 */
const loadTrackStateFor = cache(
  async (
    userId: string,
    userEmail: string,
    /**
     * Which cohort to show when someone is in more than one. Only an admin
     * with a preview run can be, and their REAL cohort wins by default - a
     * sandbox should never quietly replace the programme they are actually
     * doing. The preview is reachable by passing its id explicitly.
     */
    preferredCohortId: string | null,
  ): Promise<TrackState | null> => {
    const supabase = await createClient();

    // RLS limits this to the caller's own rows, so no extra filtering needed
    // beyond picking which cohort to show.
    const { data: memberships } = await supabase
      .from("programme_cohort_members")
      .select(
        "id, cohort_id, joined_at, is_champion, completed_at, programme_cohorts!inner(id, name, start_date, status, track_id, session_dates, is_test)",
      )
      .eq("user_id", userId)
      .in("programme_cohorts.status", ["live", "planned", "complete", "archived"])
      .order("joined_at", { ascending: false })
      .returns<{
        id: string;
        cohort_id: string;
        joined_at: string;
        is_champion: boolean;
        completed_at: string | null;
        programme_cohorts: {
          id: string;
          name: string;
          start_date: string;
          status: string;
          track_id: string;
          session_dates: Record<string, string[]> | null;
          is_test: boolean;
        };
      }[]>();

    const all = memberships ?? [];

    // A finished cohort is still readable. `complete` and `archived` used to
    // be filtered out here, which meant marking a cohort complete - the
    // normal end of a cohort - made every member's track return null and
    // rendered "You're not in a cohort yet", hiding the record of what people
    // had finished. Read them all, and rank them instead.
    //
    // Which one wins lives in membership.ts, because the write actions have to
    // reach the same answer as this loader or a submission made on one cohort
    // gets filed against the other.
    const keyed = all.map((m) => ({
      row: m,
      cohortId: m.cohort_id,
      joinedAt: m.joined_at,
      status: m.programme_cohorts.status,
      isTest: m.programme_cohorts.is_test,
    }));
    const ranked = rankMemberships(keyed).map((k) => k.row);
    const membership = pickMembership(keyed, preferredCohortId)?.row;

    if (!membership) return null;
    const cohort = membership.programme_cohorts;

    const [
      { data: itemRows },
      { data: progressRows },
      { data: responseRows },
      { data: submissionRows },
      { data: quizRows },
      { data: attendanceRows },
      { data: cohortActivityRows },
    ] = await Promise.all([
      supabase
        .from("programme_track_items")
        .select(
          "id, type, title, description, day_index, sort_order, learn_video_id, config_json",
        )
        .eq("track_id", cohort.track_id)
        .order("day_index", { ascending: true })
        .order("sort_order", { ascending: true })
        .returns<TrackItemRow[]>(),
      supabase
        .from("programme_item_progress")
        .select("track_item_id, status")
        .eq("cohort_member_id", membership.id)
        .returns<{ track_item_id: string; status: ItemState }[]>(),
      supabase
        .from("ai_score_responses")
        .select("wave")
        .eq("email", userEmail.toLowerCase())
        .returns<{ wave: string }[]>(),
      supabase
        .from("programme_submissions")
        .select(
          "track_item_id, kind, signoff_status, signoff_comment, signoff_rubric_json, superseded_by",
        )
        .eq("cohort_member_id", membership.id)
        .returns<
          {
            track_item_id: string | null;
            kind: string;
            signoff_status: string;
            signoff_comment: string | null;
            signoff_rubric_json: Record<string, unknown> | null;
            superseded_by: string | null;
          }[]
        >(),
      supabase
        .from("programme_quiz_attempts")
        .select("track_item_id, score")
        .eq("cohort_member_id", membership.id)
        .returns<{ track_item_id: string; score: number }[]>(),
      supabase
        .from("programme_session_attendance")
        .select("track_item_id, status, meta_json")
        .eq("cohort_id", cohort.id)
        .eq("user_id", userId)
        .returns<
          {
            track_item_id: string;
            status: string;
            meta_json: Record<string, unknown> | null;
          }[]
        >(),
      // Aggregate only, and only for a cohort the caller is in - the function
      // has no argument that selects a person. See the migration.
      supabase.rpc("programme_cohort_day_activity", { p_cohort_id: cohort.id }),
    ]);

    const items = itemRows ?? [];

    // Learn videos referenced by the track. Fetched by id - the track never
    // copies a video row, it points at one.
    const videoIds = Array.from(
      new Set(
        items
          .map((i) => i.learn_video_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const videosById = new Map<string, TrackVideo>();
    let learnCompletions: { video_id: string; created_at: string }[] = [];
    if (videoIds.length > 0) {
      const [{ data: videos }, { data: completions }] = await Promise.all([
        supabase
          .from("learn_videos")
          .select("id, title, loom_embed_id, loom_share_url, thumbnail_url")
          .in("id", videoIds)
          .returns<TrackVideo[]>(),
        supabase
          .from("learn_video_completions")
          .select("video_id, created_at")
          .eq("user_id", userId)
          .in("video_id", videoIds)
          .returns<{ video_id: string; created_at: string }[]>(),
      ]);
      for (const v of videos ?? []) videosById.set(v.id, v);
      learnCompletions = completions ?? [];
    }

    const progressByItemId = new Map<string, ItemState>();
    for (const p of progressRows ?? []) {
      progressByItemId.set(p.track_item_id, p.status);
    }

    // Completion is the union of our durable record and Learn's own signal,
    // with library ticks scoped to this membership. The rule and the reasoning
    // live in completed-items.ts, shared with the completion stamper so the
    // page and the certificate cannot disagree about who has finished.
    //
    // A preview run passes no joined_at: it is a sandbox with no real history
    // to protect, and scoping there would only hide the admin's own videos
    // from the screens they are checking.
    const completedItemIds = resolveCompletedItemIds({
      items,
      progress: progressRows ?? [],
      learnCompletions,
      joinedAt: cohort.is_test ? null : membership.joined_at,
    });

    const waves = new Set((responseRows ?? []).map((r) => r.wave));
    const hasBaseline = waves.has("cohort_baseline");
    const hasPostResponse = waves.has("post");

    const today = todayInLondon();

    // Feed the union into unlock resolution so a Learn-side completion shows as
    // complete on the timeline too.
    const effectiveProgress = new Map(progressByItemId);
    for (const id of completedItemIds) effectiveProgress.set(id, "complete");

    // A preview run is excluded from every report, so the entry gate has
    // nothing to protect there and does nothing but strand the admin on day 0
    // with the submission slots locked behind it.
    const entryGateOpen = hasBaseline || cohort.is_test;

    // Found before unlock resolution because the gate exemption needs it: the
    // final quiz opens by date for somebody who never checked in, every other
    // quiz waits behind the gate like the rest of the programme.
    const summativeItem = items.find(
      (i) => i.type === "quiz" && i.config_json?.summative === true,
    );

    // ---- Week one's checkpoint (rule 2b) --------------------------------
    // Both of week one's submissions must exist before week two opens. Built
    // here rather than in unlock.ts because it needs the submission rows, and
    // computed before resolveItemStates because it is an input to it.
    //
    // SUBMITTED, not approved, and not superseded - a resubmission after a
    // rejection supersedes the original, and the member has still submitted.
    const liveSubmissions = (submissionRows ?? []).filter(
      (s) => !s.superseded_by,
    );
    const submittedItemIds = new Set(
      liveSubmissions
        .map((s) => s.track_item_id)
        .filter((id): id is string => id !== null),
    );
    const weekOneRequired = items
      .filter((i) => i.type === "submission_slot" && weekOf(i.day_index) === 1)
      .map((i) => ({ id: i.id, title: i.title, dayIndex: i.day_index }));
    const weekOneOutstanding = weekOneRequired.filter(
      (i) => !submittedItemIds.has(i.id),
    );
    // A preview run is exempt, for the same reason the entry gate exempts it:
    // it is excluded from every report, so there is nothing to protect and the
    // gate could only hold the sandbox shut a week in.
    const weekOneSubmissionsIn =
      cohort.is_test || weekOneOutstanding.length === 0;

    const resolved = resolveItemStates({
      items,
      startDate: cohort.start_date,
      today,
      hasBaseline,
      enforceBaselineGate: !cohort.is_test,
      weekOneSubmissionsIn,
      progressByItemId: effectiveProgress,
      summativeItemIds: new Set(summativeItem ? [summativeItem.id] : []),
    });

    // ---- Gates ----------------------------------------------------------
    // Videos with nothing recorded yet are excluded: a member cannot be
    // required to watch a video that does not exist, and counting them would
    // make G1 unreachable for the whole cohort.
    const contentItemIds = gateableContentItemIds(items);
    const sessionItems = items.filter((i) => i.type === "session");

    const satisfiedSessionItemIds = new Set<string>();
    for (const a of attendanceRows ?? []) {
      const madeUp = a.meta_json?.make_up === true;
      if (a.status === "attended" || (a.status === "excused" && madeUp)) {
        satisfiedSessionItemIds.add(a.track_item_id);
      }
    }

    const live = (submissionRows ?? []).filter((s) => !s.superseded_by);
    const approvedSignedExamples = live.filter(
      (s) => s.kind === "signed_example" && s.signoff_status === "approved",
    ).length;
    const approvedCapstone = live.find(
      (s) => s.kind === "capstone" && s.signoff_status === "approved",
    );
    const capstoneCredits = approvedCapstone
      ? Number(approvedCapstone.signoff_rubric_json?.credits ?? 2)
      : 0;
    const hasOutstandingRejection = live.some(
      (s) => s.signoff_status === "rejected",
    );

    const summativeQuizPassMark = Number(
      summativeItem?.config_json?.pass_mark ?? 8,
    );
    const summativeScores = (quizRows ?? [])
      .filter((q) => q.track_item_id === summativeItem?.id)
      .map((q) => q.score);
    const bestSummativeQuizScore =
      summativeScores.length > 0 ? Math.max(...summativeScores) : null;

    const gates = computeGates({
      contentItemIds,
      completedItemIds,
      sessionItemIds: sessionItems.map((i) => i.id),
      satisfiedSessionItemIds,
      approvedSignedExamples,
      capstoneCredits,
      bestSummativeQuizScore,
      summativeQuizPassMark,
      hasPostResponse,
    });

    // ---- RAG ------------------------------------------------------------
    // G2 becomes impossible once every session's last slot has passed without
    // the member attending or being excused with a make-up.
    const hasImpossibleGate = sessionItems.some((item) => {
      if (satisfiedSessionItemIds.has(item.id)) return false;
      // Never terminal for a session they were locked out of. Week two's
      // session still passes on its date while rule 2b holds it shut, and
      // calling G2 impossible for missing a session nobody let them into
      // turns a recoverable "submit week one" into a permanent red.
      if (!weekOneSubmissionsIn && weekOf(item.day_index) > 1) return false;
      const dates = cohort.session_dates?.[item.id] ?? [];
      // Fallback for a cohort whose session has no date set yet: the session's
      // own programme day. "daily" is named rather than left to the default,
      // because this asks when the session WOULD have been - a question about
      // the programme's pace, not about when the item became visible. Under
      // weekly the default silently answered with that week's Monday, which
      // could call a gate impossible days before the session it names.
      const last =
        dates.length > 0
          ? dates.slice().sort().at(-1)!
          : unlockDateFor(cohort.start_date, item.day_index, "daily");
      return hasReached(last, today) && last !== today;
    });

    // Same exclusion for RAG: an unrecorded day is our backlog, not theirs.
    const outstandingActionable = outstandingItems(resolved).filter(
      (r) => !isAwaitingContent(r.item),
    );
    const outstandingCount = outstandingActionable.length;

    // RAG counts what is LATE, not what is open. Work already started never
    // re-locks, so those stay different numbers. See overdue.ts.
    const overdueCount = countOverdue(
      outstandingActionable.map((r) => ({ dayIndex: r.item.day_index })),
      { startDate: cohort.start_date, today },
    );

    const rag = computeRag({
      overdueCount,
      hasOutstandingRejection,
      hasImpossibleGate,
      joinedOn: membership.joined_at.slice(0, 10),
      cohortStartDate: cohort.start_date,
      today,
    });

    const submissionByItemId = new Map<
      string,
      {
      kind: string;
      signoffStatus: string;
      signoffComment: string | null;
      reviewedByAi: boolean;
    }
    >();
    for (const s of live) {
      if (!s.track_item_id) continue;
      submissionByItemId.set(s.track_item_id, {
        kind: s.kind,
        signoffStatus: s.signoff_status,
        signoffComment: s.signoff_comment,
        // Said plainly to the member rather than buried: a programme about
        // using AI well should not be coy about where its own marks came from.
        reviewedByAi: s.signoff_rubric_json?.reviewer === "ai",
      });
    }

    // ---- G3 routes, next steps, activity -------------------------------
    const routes = g3Routes({ approvedSignedExamples, capstoneCredits });

    const rejected = live.find((s) => s.signoff_status === "rejected");
    // The route back to green has to be built from the same items that took
    // it away, or it lists work that was never what the status was about.
    const nextSteps = stepsToGreen({
      rag,
      outstanding: overdueOnly(
        outstandingActionable.map((r) => ({
          dayIndex: r.item.day_index,
          title: r.item.title,
        })),
        { startDate: cohort.start_date, today },
      ),
      hasOutstandingRejection,
      rejectedTitle: rejected?.track_item_id
        ? (items.find((i) => i.id === rejected.track_item_id)?.title ?? null)
        : null,
      hasImpossibleGate,
    });

    // Only items a member can be asked to do count toward a day's share, so an
    // unrecorded video never drags a day down. Same rule the gate uses.
    const gateable = new Set(contentItemIds);
    const peersByDay = new Map<number, { peers: number; done: number }>();
    for (const row of (cohortActivityRows ?? []) as {
      day_index: number;
      peers: number;
      completions: number;
    }[]) {
      peersByDay.set(row.day_index, {
        peers: row.peers,
        done: row.completions,
      });
    }

    const activity: DayActivity[] = [];
    for (let day = 1; day <= 15; day += 1) {
      const dayItems = resolved.filter(
        (r) => r.item.day_index === day && gateable.has(r.item.id),
      );
      const done = dayItems.filter((r) =>
        completedItemIds.has(r.item.id),
      ).length;

      const agg = peersByDay.get(day);
      // Denominator is peers times the day's item count, so one peer who did
      // half a day reads as half rather than as a whole day's activity.
      const peerTotal = agg ? agg.peers * dayItems.length : 0;

      activity.push({
        dayIndex: day,
        you: dayItems.length === 0 ? 0 : done / dayItems.length,
        cohort: peerTotal > 0 ? Math.min(1, agg!.done / peerTotal) : null,
        awaitsContent: resolved.some(
          (r) => r.item.day_index === day && isAwaitingContent(r.item),
        ),
        locked: dayItems.length > 0 && dayItems.every((r) => r.state === "locked"),
      });
    }

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        startDate: cohort.start_date,
        status: cohort.status,
        sessionDates: cohort.session_dates ?? {},
        isTest: cohort.is_test,
      },
      otherCohorts: ranked
        .filter((m) => m.cohort_id !== cohort.id)
        .map((m) => ({
          id: m.cohort_id,
          name: m.programme_cohorts.name,
          isTest: m.programme_cohorts.is_test,
        })),
      membership: {
        id: membership.id,
        joinedAt: membership.joined_at,
        isChampion: membership.is_champion,
        completedAt: membership.completed_at,
      },
      today,
      hasBaseline,
      entryGateOpen,
      weekOneGate: {
        satisfied: weekOneSubmissionsIn,
        required: weekOneRequired,
        outstanding: weekOneOutstanding,
      },
      hasPostResponse,
      items: resolved,
      videosById,
      completedItemIds,
      gates,
      rag,
      outstandingCount,
      overdueCount,
      g3Routes: routes,
      nextSteps,
      activity,
      submissionByItemId,
    };
  },
);

/**
 * NORMALISES THE OPTIONAL ARGUMENT BEFORE cache() SEES IT.
 *
 * `cache()` keys on the arguments it is called with, so `(id, email)` and
 * `(id, email, null)` are two different entries and would each run the whole
 * multi-query load. That was harmless while only pages called this; it stopped
 * being harmless when learn/layout.tsx started asking on every /learn route,
 * because /learn/track asks with `cohortParam ?? null` and would have paid
 * twice on the section's busiest page. A default applied inside the memoized
 * function would not have helped - it is applied after the key is computed.
 */
export function loadTrackState(
  userId: string,
  userEmail: string,
  preferredCohortId: string | null = null,
): Promise<TrackState | null> {
  return loadTrackStateFor(userId, userEmail, preferredCohortId);
}
