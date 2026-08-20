import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeGates, type GateSet } from "./gates";
import { computeRag, type RagStatus } from "./rag";
import {
  resolveItemStates,
  outstandingItems,
  type ItemState,
  type ResolvedItem,
} from "./unlock";
import { todayInLondon, hasReached, unlockDateFor } from "./working-days";

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
  };
  membership: {
    id: string;
    joinedAt: string;
    isChampion: boolean;
    completedAt: string | null;
  };
  today: string;
  hasBaseline: boolean;
  hasPostResponse: boolean;
  items: ResolvedItem<TrackItemRow>[];
  videosById: Map<string, TrackVideo>;
  /** Union of item_progress completions and Learn's own completion signal. */
  completedItemIds: Set<string>;
  gates: GateSet;
  rag: RagStatus;
  outstandingCount: number;
};

/**
 * The member's current programme state, or null when they aren't in a live
 * cohort (which is most people until they're enrolled).
 */
export const loadTrackState = cache(
  async (userId: string, userEmail: string): Promise<TrackState | null> => {
    const supabase = await createClient();

    // RLS limits this to the caller's own rows, so no extra filtering needed
    // beyond picking the active cohort.
    const { data: membership } = await supabase
      .from("programme_cohort_members")
      .select(
        "id, cohort_id, joined_at, is_champion, completed_at, programme_cohorts!inner(id, name, start_date, status, track_id, session_dates)",
      )
      .eq("user_id", userId)
      .in("programme_cohorts.status", ["live", "planned"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
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
        };
      }>();

    if (!membership) return null;
    const cohort = membership.programme_cohorts;

    const [
      { data: itemRows },
      { data: progressRows },
      { data: responseRows },
      { data: submissionRows },
      { data: quizRows },
      { data: attendanceRows },
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
        .select("kind, signoff_status, signoff_rubric_json, superseded_by")
        .eq("cohort_member_id", membership.id)
        .returns<
          {
            kind: string;
            signoff_status: string;
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
    let learnCompletions = new Set<string>();
    if (videoIds.length > 0) {
      const [{ data: videos }, { data: completions }] = await Promise.all([
        supabase
          .from("learn_videos")
          .select("id, title, loom_embed_id, loom_share_url, thumbnail_url")
          .in("id", videoIds)
          .returns<TrackVideo[]>(),
        supabase
          .from("learn_video_completions")
          .select("video_id")
          .eq("user_id", userId)
          .in("video_id", videoIds)
          .returns<{ video_id: string }[]>(),
      ]);
      for (const v of videos ?? []) videosById.set(v.id, v);
      learnCompletions = new Set((completions ?? []).map((c) => c.video_id));
    }

    const progressByItemId = new Map<string, ItemState>();
    for (const p of progressRows ?? []) {
      progressByItemId.set(p.track_item_id, p.status);
    }

    // Completion is the UNION of our durable record and Learn's own signal.
    //
    // Reading the union rather than only item_progress means a video ticked on
    // /learn before the member ever opened the track still counts. Reading
    // item_progress as part of the union (rather than deferring to Learn) means
    // un-ticking on /learn cannot regress someone past G1 once the track has
    // recorded the completion.
    const completedItemIds = new Set<string>();
    for (const item of items) {
      if (progressByItemId.get(item.id) === "complete") {
        completedItemIds.add(item.id);
        continue;
      }
      if (item.learn_video_id && learnCompletions.has(item.learn_video_id)) {
        completedItemIds.add(item.id);
      }
    }

    const waves = new Set((responseRows ?? []).map((r) => r.wave));
    const hasBaseline = waves.has("cohort_baseline");
    const hasPostResponse = waves.has("post");

    const today = todayInLondon();

    // Feed the union into unlock resolution so a Learn-side completion shows as
    // complete on the timeline too.
    const effectiveProgress = new Map(progressByItemId);
    for (const id of completedItemIds) effectiveProgress.set(id, "complete");

    const resolved = resolveItemStates({
      items,
      startDate: cohort.start_date,
      today,
      hasBaseline,
      progressByItemId: effectiveProgress,
    });

    // ---- Gates ----------------------------------------------------------
    const contentItemIds = items
      .filter((i) => i.type === "video" || i.type === "use_example")
      .map((i) => i.id);
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

    const summativeItem = items.find(
      (i) => i.type === "quiz" && i.config_json?.summative === true,
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
      const dates = cohort.session_dates?.[item.id] ?? [];
      const last =
        dates.length > 0
          ? dates.slice().sort().at(-1)!
          : unlockDateFor(cohort.start_date, item.day_index);
      return hasReached(last, today) && last !== today;
    });

    const outstandingCount = outstandingItems(resolved).length;

    const rag = computeRag({
      outstandingCount,
      hasOutstandingRejection,
      hasImpossibleGate,
      joinedOn: membership.joined_at.slice(0, 10),
      cohortStartDate: cohort.start_date,
      today,
    });

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        startDate: cohort.start_date,
        status: cohort.status,
        sessionDates: cohort.session_dates ?? {},
      },
      membership: {
        id: membership.id,
        joinedAt: membership.joined_at,
        isChampion: membership.is_champion,
        completedAt: membership.completed_at,
      },
      today,
      hasBaseline,
      hasPostResponse,
      items: resolved,
      videosById,
      completedItemIds,
      gates,
      rag,
      outstandingCount,
    };
  },
);
