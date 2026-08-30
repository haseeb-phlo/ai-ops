import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeGates } from "./gates";
import { decideCompletion } from "./completion";
import { parseQuizConfig, bestScore } from "./quiz";
import { satisfiedSessionIds } from "./attendance";
import { gateableContentItemIds } from "./content-readiness";
import { resolveCompletedItemIds } from "./completed-items";

/**
 * Stamps completion when all four gates pass, exactly once.
 *
 * Called from anywhere a gate can flip: passing the summative quiz, a lead
 * approving the fifth signed example, submitting the post check-in. It is safe
 * to call speculatively - it no-ops unless this is genuinely the moment.
 *
 * Returns true only on the transition, so the caller can show "you're done"
 * and (from part 8) fire the congratulation. The UPDATE is guarded on
 * `completed_at is null`, so two concurrent calls cannot both report the
 * transition and announce the same person twice.
 *
 * @param client Pass one when there is no user session to borrow - the
 * automatic reviewer runs in an after() callback and in a cron sweep, and
 * the second of those has no cookies at all. Omitted, it reads as the caller,
 * which is what every human-triggered path wants.
 */
export async function maybeCompleteProgramme(
  cohortMemberId: string,
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const supabase = client ?? (await createClient());

  const { data: member } = await supabase
    .from("programme_cohort_members")
    .select(
      "id, user_id, completed_at, cohort_id, joined_at, programme_cohorts!inner(track_id, is_test)",
    )
    .eq("id", cohortMemberId)
    .maybeSingle<{
      id: string;
      user_id: string;
      completed_at: string | null;
      cohort_id: string;
      joined_at: string;
      programme_cohorts: { track_id: string; is_test: boolean };
    }>();

  if (!member || member.completed_at) return false;

  const [
    { data: items },
    { data: progress },
    { data: attendance },
    { data: submissions },
    { data: quizzes },
    { data: postWave },
  ] = await Promise.all([
    supabase
      .from("programme_track_items")
      .select("id, type, learn_video_id, config_json")
      .eq("track_id", member.programme_cohorts.track_id)
      .returns<
        { id: string; type: string; learn_video_id: string | null; config_json: unknown }[]
      >(),
    supabase
      .from("programme_item_progress")
      .select("track_item_id, status")
      .eq("cohort_member_id", cohortMemberId)
      .returns<{ track_item_id: string; status: string }[]>(),
    supabase
      .from("programme_session_attendance")
      .select("track_item_id, status, meta_json")
      .eq("cohort_id", member.cohort_id)
      .eq("user_id", member.user_id)
      .returns<
        {
          track_item_id: string;
          status: "attended" | "absent" | "excused";
          meta_json: Record<string, unknown> | null;
        }[]
      >(),
    supabase
      .from("programme_submissions")
      .select("kind, signoff_status, signoff_rubric_json, superseded_by")
      .eq("cohort_member_id", cohortMemberId)
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
      .eq("cohort_member_id", cohortMemberId)
      .returns<{ track_item_id: string; score: number }[]>(),
    supabase
      .from("ai_score_responses")
      .select("wave")
      .eq("user_id", member.user_id)
      .eq("wave", "post")
      .maybeSingle<{ wave: string }>(),
  ]);

  const itemList = items ?? [];

  // Learn's own completion signal, which is half of what counts as done.
  //
  // This used to be missing, and the omission was invisible from the outside:
  // the member's track page reads the union and showed every gate green, while
  // this function counted item_progress alone, decided G1 had not passed, and
  // never stamped anyone complete. Nobody got a certificate they had earned.
  // Both sides now go through resolveCompletedItemIds.
  const trackVideoIds = itemList
    .map((i) => i.learn_video_id)
    .filter((id): id is string => Boolean(id));
  const { data: learnCompletions } = trackVideoIds.length
    ? await supabase
        .from("learn_video_completions")
        .select("video_id, created_at")
        .eq("user_id", member.user_id)
        .in("video_id", trackVideoIds)
        .returns<{ video_id: string; created_at: string }[]>()
    : { data: [] as { video_id: string; created_at: string }[] };

  const completedItemIds = resolveCompletedItemIds({
    items: itemList,
    progress: progress ?? [],
    learnCompletions: learnCompletions ?? [],
    joinedAt: member.programme_cohorts.is_test ? null : member.joined_at,
  });

  const summative = itemList.find(
    (i) =>
      i.type === "quiz" &&
      (i.config_json as { summative?: boolean } | null)?.summative === true,
  );
  const summativeConfig = summative
    ? parseQuizConfig(summative.config_json)
    : null;

  const live = (submissions ?? []).filter((s) => !s.superseded_by);
  const approvedCapstone = live.find(
    (s) => s.kind === "capstone" && s.signoff_status === "approved",
  );

  const gates = computeGates({
    contentItemIds: gateableContentItemIds(itemList),
    completedItemIds,
    sessionItemIds: itemList.filter((i) => i.type === "session").map((i) => i.id),
    satisfiedSessionItemIds: satisfiedSessionIds(
      (attendance ?? []).map((a) => ({
        trackItemId: a.track_item_id,
        status: a.status,
        makeUp: a.meta_json?.make_up === true,
      })),
    ),
    approvedSignedExamples: live.filter(
      (s) => s.kind === "signed_example" && s.signoff_status === "approved",
    ).length,
    capstoneCredits: approvedCapstone
      ? Number(approvedCapstone.signoff_rubric_json?.credits ?? 2)
      : 0,
    bestSummativeQuizScore: bestScore(
      (quizzes ?? [])
        .filter((q) => q.track_item_id === summative?.id)
        .map((q) => q.score),
    ),
    summativeQuizPassMark: summativeConfig?.pass_mark ?? 8,
    hasPostResponse: postWave !== null,
  });

  const decision = decideCompletion({ gates, completedAt: member.completed_at });
  if (decision.action !== "complete") return false;

  // Guarded on completed_at still being null, so two concurrent callers cannot
  // both come back true and announce the same person twice.
  const { data: stamped } = await supabase
    .from("programme_cohort_members")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", cohortMemberId)
    .is("completed_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  return stamped !== null;
}
