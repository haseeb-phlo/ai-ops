import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeGates, type GateSet } from "./gates";
import { computeRag, type RagStatus } from "./rag";
import { countOverdue } from "./overdue";
import { resolveItemStates, outstandingItems, type ItemState } from "./unlock";
import {
  hasDayArrived,
  heldDayIndexes,
  openThroughInLondon,
  todayInLondon,
  unlockDateFor,
} from "./working-days";
import {
  filedTaskEvidenceByItem,
  taskEvidenceByDay,
  taskTakesLink,
  type TaskEvidence,
} from "./task-link";
import {
  isG2Impossible,
  satisfiedSessionIds,
  summariseAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
} from "./attendance";
import { buildGateFunnel, type GateFunnel } from "./funnel";
import {
  buildQuizResultRows,
  summariseQuizColumns,
  toQuizColumn,
  type QuizColumn,
  type QuizColumnSummary,
  type QuizResultRow,
} from "./quiz-results";
import { gateableContentItemIds, isAwaitingContent } from "./content-readiness";

/**
 * Everything the programme admin screens need for one cohort, in one pass.
 *
 * Deliberately batched: the roster and heatmap are members x items grids, so
 * loading per member would be N+1 queries deep. Six queries total, then all
 * the arithmetic happens in the pure modules.
 */

export type AdminMember = {
  cohortMemberId: string;
  userId: string;
  displayName: string;
  isChampion: boolean;
  joinedOn: string;
  rag: RagStatus;
  gates: GateSet;
  outstandingCount: number;
  /** Completion state per day index, for the heatmap row. */
  dayState: Map<number, "complete" | "partial" | "none" | "locked">;
  /** Attendance per session item id. */
  attendance: Map<string, { status: AttendanceStatus; makeUp: boolean; slot: number | null }>;
};

/**
 * One member's Task links, for the admin table that chases the gaps.
 *
 * Every day has a Task and every Task takes a link, so this is a members x
 * days grid with a hole wherever nobody filed one. Rows carry the count so
 * the header can say "9 of 25" without the table recomputing it.
 */
export type TaskEvidenceRow = {
  cohortMemberId: string;
  displayName: string;
  /** Evidence by day index. A missing day means nothing was filed. */
  byDay: Record<number, TaskEvidence>;
};

export type DayLink = {
  dayIndex: number;
  /** The day's topic, taken from its video item so the two cannot disagree. */
  title: string;
  /** The date it opens, in daily-unlock terms. */
  date: string;
  /** Whether it has opened yet - days open at 7am London. */
  opened: boolean;
};

export type SessionColumn = {
  trackItemId: string;
  title: string;
  dayIndex: number;
  slotDates: string[];
};

export type CohortAdminView = {
  cohort: {
    id: string;
    name: string;
    startDate: string;
    status: string;
    isTest: boolean;
  };
  today: string;
  members: AdminMember[];
  sessions: SessionColumn[];
  dayIndexes: number[];
  /**
   * One shareable link per programme day, for the daily Slack post.
   *
   * The href is deliberately cohort-agnostic - `/learn/track?day=N` and no
   * cohort id. A member lands on their OWN cohort's day N, which is what a
   * link pasted into a channel has to do; pinning the cohort would send
   * anyone in a different one to a track they cannot see. `opened` is here so
   * the person posting can tell at a glance which day is live, on the same
   * 7am clock the members are on.
   */
  dayLinks: DayLink[];
  /** Filed Task evidence per member, and the days worth showing a column for. */
  taskLinks: TaskEvidenceRow[];
  taskDayIndexes: number[];
  funnel: GateFunnel;
  /**
   * Every quiz on the track, and where each member stands on it.
   *
   * Separate from `funnel` on purpose. The funnel answers "how many finished
   * gate G4", which is one boolean per member off the summative quiz alone;
   * this answers "what has this cohort actually scored", across all three,
   * which is the question the gate count cannot be asked.
   */
  quizColumns: QuizColumn[];
  quizResults: QuizResultRow[];
  quizSummaries: QuizColumnSummary[];
  attendanceBySession: Map<
    string,
    ReturnType<typeof summariseAttendance>
  >;
  /**
   * Before/after work samples, WITH the member's name on them.
   *
   * Two readers, and the difference between them is the point. This is the
   * programme owner's view: who has submitted, who has not, and a link they
   * can open. The blind-scoring CSV is built from the same rows with the name
   * dropped and the id hashed - see exportWorkSamplePairs, where that mapping
   * is written out rather than implied, because it is the anonymity boundary.
   */
  workSamples: {
    cohortMemberId: string;
    displayName: string;
    preRef: string | null;
    postRef: string | null;
    preSubmittedAt: string | null;
    postSubmittedAt: string | null;
  }[];
};

export const loadCohortAdminView = cache(
  async (cohortId: string): Promise<CohortAdminView | null> => {
    const supabase = await createClient();

    const { data: cohort } = await supabase
      .from("programme_cohorts")
      .select("id, name, start_date, status, is_test, track_id, session_dates")
      .eq("id", cohortId)
      .maybeSingle<{
        id: string;
        name: string;
        start_date: string;
        status: string;
        is_test: boolean;
        track_id: string;
        session_dates: Record<string, string[]> | null;
      }>();
    if (!cohort) return null;

    const [
      { data: memberRows },
      { data: itemRows },
      { data: progressRows },
      { data: attendanceRows },
      { data: submissionRows },
      { data: quizRows },
    ] = await Promise.all([
      supabase
        .from("programme_cohort_members")
        .select("id, user_id, is_champion, joined_at")
        .eq("cohort_id", cohortId)
        .returns<
          { id: string; user_id: string; is_champion: boolean; joined_at: string }[]
        >(),
      supabase
        .from("programme_track_items")
        .select("id, type, title, day_index, learn_video_id, config_json")
        .eq("track_id", cohort.track_id)
        .order("day_index")
        .order("sort_order")
        .returns<
          {
            id: string;
            type: string;
            title: string;
            day_index: number;
            learn_video_id: string | null;
            config_json: Record<string, unknown>;
          }[]
        >(),
      supabase
        .from("programme_item_progress")
        .select("cohort_member_id, track_item_id, status, meta_json")
        .returns<
          {
            cohort_member_id: string;
            track_item_id: string;
            status: ItemState;
            meta_json: Record<string, unknown> | null;
          }[]
        >(),
      supabase
        .from("programme_session_attendance")
        .select("user_id, track_item_id, status, slot, meta_json")
        .eq("cohort_id", cohortId)
        .returns<
          {
            user_id: string;
            track_item_id: string;
            status: AttendanceStatus;
            slot: number | null;
            meta_json: Record<string, unknown> | null;
          }[]
        >(),
      supabase
        .from("programme_submissions")
        .select(
          "cohort_member_id, track_item_id, kind, signoff_status, signoff_rubric_json, artefact_url, superseded_by, created_at",
        )
        .returns<
          {
            cohort_member_id: string;
            track_item_id: string | null;
            kind: string;
            signoff_status: string;
            signoff_rubric_json: Record<string, unknown> | null;
            created_at: string;
            artefact_url: string | null;
            superseded_by: string | null;
          }[]
        >(),
      // `answers_json` is deliberately NOT selected here. The grid only needs
      // scores and timings, and this query carries no cohort filter - it
      // reads every attempt in the table - so pulling a jsonb blob per row
      // would grow with the whole programme rather than with this cohort.
      // The per-question breakdown loads answers for ONE member instead, in
      // loadMemberQuizDetail.
      supabase
        .from("programme_quiz_attempts")
        .select("id, cohort_member_id, track_item_id, score, created_at")
        .returns<
          {
            id: string;
            cohort_member_id: string;
            track_item_id: string;
            score: number;
            created_at: string;
          }[]
        >(),
    ]);

    const members = memberRows ?? [];
    const items = itemRows ?? [];
    const today = todayInLondon();
    // What has actually opened, which before 7am London is yesterday. Used for
    // the two questions about visibility - item states and which task columns
    // exist - while `today` stays the calendar date for overdue and RAG.
    const openThrough = openThroughInLondon();
    const held = heldDayIndexes();

    // Names: profiles are readable to any authenticated user; this page is
    // super-admin gated anyway.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", members.map((m) => m.user_id))
      .returns<{ user_id: string; display_name: string | null }[]>();
    const nameByUserId = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]),
    );

    const sessionItems = items.filter((i) => i.type === "session");
    const contentItemIds = gateableContentItemIds(items);
    const summativeItem = items.find(
      (i) => i.type === "quiz" && i.config_json?.summative === true,
    );
    const summativeQuizPassMark = Number(
      summativeItem?.config_json?.pass_mark ?? 8,
    );
    const summativeIds = new Set(summativeItem ? [summativeItem.id] : []);

    // Every quiz on the track, opened or not. All three are shown always -
    // three columns that appear one per week would change the grid's shape
    // mid-programme, and `opened` already lets a cell say "not open yet"
    // rather than reading as a member who skipped it.
    const quizColumns: QuizColumn[] = items
      .filter((i) => i.type === "quiz")
      .map((i) =>
        toQuizColumn({
          id: i.id,
          title: i.title,
          day_index: i.day_index,
          config_json: i.config_json,
          opensOn: unlockDateFor(cohort.start_date, i.day_index),
          opened: hasDayArrived({
            dayIndex: i.day_index,
            startDate: cohort.start_date,
            today: openThrough,
          }),
        }),
      );

    const sessions: SessionColumn[] = sessionItems.map((i) => ({
      trackItemId: i.id,
      title: i.title,
      dayIndex: i.day_index,
      slotDates: cohort.session_dates?.[i.id] ?? [],
    }));

    // Index everything by member so the per-member pass is cheap.
    const progressByMember = new Map<string, Map<string, ItemState>>();
    // Same rows, kept separately: the task link a member filed lives in the
    // progress row's meta_json, and resolveItemStates only wants the status.
    const metaByMember = new Map<string, Map<string, unknown>>();
    for (const p of progressRows ?? []) {
      let map = progressByMember.get(p.cohort_member_id);
      if (!map) {
        map = new Map();
        progressByMember.set(p.cohort_member_id, map);
      }
      map.set(p.track_item_id, p.status);

      let meta = metaByMember.get(p.cohort_member_id);
      if (!meta) {
        meta = new Map();
        metaByMember.set(p.cohort_member_id, meta);
      }
      meta.set(p.track_item_id, p.meta_json);
    }

    const attendanceByUser = new Map<string, typeof attendanceRows>();
    for (const a of attendanceRows ?? []) {
      const list = attendanceByUser.get(a.user_id) ?? [];
      list.push(a);
      attendanceByUser.set(a.user_id, list);
    }

    const submissionsByMember = new Map<string, typeof submissionRows>();
    for (const s of submissionRows ?? []) {
      if (s.superseded_by) continue;
      const list = submissionsByMember.get(s.cohort_member_id) ?? [];
      list.push(s);
      submissionsByMember.set(s.cohort_member_id, list);
    }

    // SUMMATIVE ONLY, and it has to stay that way: this map is the sole input
    // to `bestSummativeQuizScore`, so letting a Week 1 or Week 2 score in
    // would pass gate G4 off a formative quiz. The admin grid reads its own
    // rows from the same attempts and never this map.
    const quizByMember = new Map<string, number[]>();
    for (const q of quizRows ?? []) {
      if (q.track_item_id !== summativeItem?.id) continue;
      const list = quizByMember.get(q.cohort_member_id) ?? [];
      list.push(q.score);
      quizByMember.set(q.cohort_member_id, list);
    }

    // Check-in responses, by user id, so G4 is accurate here too - and so the
    // two check-in items can be resolved as complete, which is the only place
    // that fact is recorded. See unlock.ts.
    const { data: checkInRows } = await supabase
      .from("ai_score_responses")
      .select("user_id, wave")
      .in("wave", ["cohort_baseline", "post"])
      .not("user_id", "is", null)
      .returns<{ user_id: string; wave: string }[]>();
    const baselineUserIds = new Set(
      (checkInRows ?? [])
        .filter((r) => r.wave === "cohort_baseline")
        .map((r) => r.user_id),
    );
    const postUserIds = new Set(
      (checkInRows ?? []).filter((r) => r.wave === "post").map((r) => r.user_id),
    );

    const dayIndexes = [
      ...new Set(items.filter((i) => i.day_index > 0).map((i) => i.day_index)),
    ].sort((a, b) => a - b);

    // Titled from the day's video item, which carries the topic. Falling back
    // to "Day N" rather than to an empty string, because a day whose video row
    // is missing still has a link worth posting.
    const titleByDay = new Map(
      items
        .filter((i) => i.type === "video" && i.day_index > 0)
        .map((i) => [i.day_index, i.title]),
    );
    const dayLinks: DayLink[] = dayIndexes.map((dayIndex) => ({
      dayIndex,
      title: titleByDay.get(dayIndex) ?? `Day ${dayIndex}`,
      date: unlockDateFor(cohort.start_date, dayIndex, "daily"),
      opened: hasDayArrived({
        dayIndex,
        startDate: cohort.start_date,
        today: openThrough,
      }),
    }));

    // Hoisted out of the per-member loop: the same Set for every row, and
    // G3 counts a filed Task link, so every member's gates need it.
    const taskItemIds = new Set(
      items.filter((i) => i.type === "use_example").map((i) => i.id),
    );

    const adminMembers: AdminMember[] = members.map((member) => {
      const progress = progressByMember.get(member.id) ?? new Map();
      const attendanceRecords: AttendanceRecord[] = (
        attendanceByUser.get(member.user_id) ?? []
      ).map((a) => ({
        trackItemId: a.track_item_id,
        status: a.status,
        makeUp: a.meta_json?.make_up === true,
      }));
      const satisfied = satisfiedSessionIds(attendanceRecords);

      const resolved = resolveItemStates({
        items,
        startDate: cohort.start_date,
        today: openThrough,
        // The roster measures how LATE work is, not what to render, so it
        // does not apply the entry gate: a member who never checked in is
        // behind on everything rather than excused from it, and greening them
        // out would hide the people who most need chasing.
        hasBaseline: true,
        // Which is exactly why the check-ins are asked separately - passing
        // that `true` through as "the check-in is done" would credit everyone
        // who has not taken it. See unlock.ts.
        answeredCheckIns: {
          baseline: baselineUserIds.has(member.user_id),
          post: postUserIds.has(member.user_id),
        },
        progressByItemId: progress,
        summativeItemIds: summativeIds,
        // Rule 4b - a held day is not work the member is late on.
        heldDayIndexes: held,
      });

      const completedItemIds = new Set(
        resolved.filter((r) => r.state === "complete").map((r) => r.item.id),
      );

      const live = submissionsByMember.get(member.id) ?? [];
      const approvedSignedExamples = live.filter(
        (s) => s.kind === "signed_example" && s.signoff_status === "approved",
      ).length;
      const approvedCapstone = live.find(
        (s) => s.kind === "capstone" && s.signoff_status === "approved",
      );
      const scores = quizByMember.get(member.id) ?? [];

      const gates = computeGates({
        contentItemIds,
        completedItemIds,
        sessionItemIds: sessionItems.map((i) => i.id),
        satisfiedSessionItemIds: satisfied,
        approvedSignedExamples,
        filedTaskEvidence: filedTaskEvidenceByItem({
          taskItemIds: taskItemIds,
          metaByItemId: metaByMember.get(member.id) ?? new Map(),
        }).size,
        capstoneCredits: approvedCapstone
          ? Number(approvedCapstone.signoff_rubric_json?.credits ?? 2)
          : 0,
        bestSummativeQuizScore: scores.length ? Math.max(...scores) : null,
        summativeQuizPassMark,
        hasPostResponse: postUserIds.has(member.user_id),
      });

      const outstandingActionable = outstandingItems(resolved).filter(
        (r) => !isAwaitingContent(r.item),
      );
      const outstandingCount = outstandingActionable.length;

      const rag = computeRag({
        // Late, not merely open - the admin heatmap has to agree with the
        // member's own banner. See overdue.ts.
        overdueCount: countOverdue(
          outstandingActionable.map((r) => ({ dayIndex: r.item.day_index })),
          { startDate: cohort.start_date, today },
        ),
        hasOutstandingRejection: live.some(
          (s) => s.signoff_status === "rejected",
        ),
        hasImpossibleGate: isG2Impossible({
          sessions: sessions.map((s) => ({
            trackItemId: s.trackItemId,
            slotDates: s.slotDates,
            fallbackDate: unlockDateFor(cohort.start_date, s.dayIndex),
          })),
          satisfied,
          today,
        }),
        joinedOn: member.joined_at.slice(0, 10),
        cohortStartDate: cohort.start_date,
        today,
      });

      // One cell per day for the heatmap row.
      const dayState = new Map<
        number,
        "complete" | "partial" | "none" | "locked"
      >();
      for (const day of dayIndexes) {
        const forDay = resolved.filter((r) => r.item.day_index === day);
        if (forDay.every((r) => r.state === "locked")) dayState.set(day, "locked");
        else if (forDay.every((r) => r.state === "complete"))
          dayState.set(day, "complete");
        else if (forDay.some((r) => r.state === "complete" || r.state === "started"))
          dayState.set(day, "partial");
        else dayState.set(day, "none");
      }

      const attendance = new Map(
        (attendanceByUser.get(member.user_id) ?? []).map((a) => [
          a.track_item_id,
          {
            status: a.status,
            makeUp: a.meta_json?.make_up === true,
            slot: a.slot,
          },
        ]),
      );

      return {
        cohortMemberId: member.id,
        userId: member.user_id,
        displayName: nameByUserId.get(member.user_id) || "(no name)",
        isChampion: member.is_champion,
        joinedOn: member.joined_at.slice(0, 10),
        rag,
        gates,
        outstandingCount,
        dayState,
        attendance,
      };
    });

    adminMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Driven off `adminMembers`, not off `quizRows`. The attempts query has
    // no cohort filter, so iterating it would put other cohorts' scores on
    // this cohort's grid; keying every lookup by this cohort's member ids is
    // what keeps it honest.
    const quizResults: QuizResultRow[] = buildQuizResultRows({
      members: adminMembers.map((m) => ({
        cohortMemberId: m.cohortMemberId,
        displayName: m.displayName,
      })),
      columns: quizColumns,
      attempts: (quizRows ?? []).map((q) => ({
        id: q.id,
        cohortMemberId: q.cohort_member_id,
        trackItemId: q.track_item_id,
        score: q.score,
        // Not selected for the grid; the detail view loads them per member.
        answers: [],
        createdAt: q.created_at,
      })),
    });
    const quizSummaries = summariseQuizColumns(quizColumns, quizResults);

    const attendanceBySession = new Map(
      sessions.map((session) => [
        session.trackItemId,
        summariseAttendance(
          (attendanceRows ?? [])
            .filter((a) => a.track_item_id === session.trackItemId)
            .map((a) => ({
              trackItemId: a.track_item_id,
              status: a.status,
              makeUp: a.meta_json?.make_up === true,
            })),
          members.length,
        ),
      ]),
    );

    // Task days, capped at the days that have actually opened: a column of
    // empty cells for day 12 in week one reads as fifteen people who have not
    // submitted rather than a day nobody could have done yet.
    //
    // Same reasoning drops the days with no field (LINKLESS_TASK_DAYS in
    // task-link.ts). Their column could only ever be empty, so leaving it in
    // reads as a whole cohort ignoring day 5 rather than a day that never
    // asked. Filtered on the day rather than on the data, so it stays empty
    // even if an old link is still sitting in somebody's meta_json.
    const taskItems = items.filter((i) => i.type === "use_example");
    const taskDayIndexes = taskItems
      .filter(
        (i) =>
          taskTakesLink(i.day_index) &&
          hasDayArrived({
            dayIndex: i.day_index,
            startDate: cohort.start_date,
            today: openThrough,
          }),
      )
      .map((i) => i.day_index)
      .sort((a, b) => a - b);

    const taskLinks: TaskEvidenceRow[] = adminMembers.map((member) => ({
      cohortMemberId: member.cohortMemberId,
      displayName: member.displayName,
      byDay: taskEvidenceByDay({
        taskItems,
        metaByItemId: metaByMember.get(member.cohortMemberId) ?? new Map(),
      }),
    }));

    const workSamples = adminMembers.map((member) => {
      const live = submissionsByMember.get(member.cohortMemberId) ?? [];
      const pre = live.find((s) => s.kind === "work_sample_pre");
      const post = live.find((s) => s.kind === "work_sample_post");
      return {
        cohortMemberId: member.cohortMemberId,
        displayName: member.displayName,
        preRef: pre?.artefact_url ?? null,
        postRef: post?.artefact_url ?? null,
        preSubmittedAt: pre?.created_at ?? null,
        postSubmittedAt: post?.created_at ?? null,
      };
    });

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        startDate: cohort.start_date,
        status: cohort.status,
        isTest: cohort.is_test,
      },
      today,
      members: adminMembers,
      sessions,
      dayIndexes,
      dayLinks,
      taskLinks,
      taskDayIndexes,
      funnel: buildGateFunnel(adminMembers.map((m) => m.gates)),
      quizColumns,
      quizResults,
      quizSummaries,
      attendanceBySession: attendanceBySession,
      workSamples,
    };
  },
);
