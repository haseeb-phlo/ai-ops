import "server-only";
import { askClaude, CLAUDE_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeCompleteProgramme } from "./complete-action";
import {
  buildFeedbackRewritePrompt,
  buildReviewPrompt,
  decideReview,
  parseReviewResponse,
  type SubmissionForReview,
} from "./ai-review";
import {
  applyStyleFixes,
  describeViolations,
  findStyleViolations,
} from "./feedback-style";

/**
 * Running one AI review.
 *
 * WHY THE SERVICE-ROLE CLIENT. The obvious alternative - a SECURITY DEFINER
 * RPC the member's session calls - would put "approve this submission with
 * these four scores" behind a member's credentials. Whatever the guard, that
 * is a path from someone being marked to their own mark. There isn't one
 * here: the review runs entirely server-side, the scores come from the model
 * and never from the request, and the write goes through the same admin
 * client the cron jobs use. Nothing new is granted to anybody.
 *
 * WHERE IT RUNS. `after()` in the submit action, so the member gets their
 * confirmation immediately and the review lands seconds later, plus a nightly
 * sweep for anything the callback never reached. Both call this function.
 *
 * FAILURE IS A HUMAN, NOT A PASS. Every error path leaves signoff_status
 * pending and records ai_decision = 'error'. An unreachable model, an
 * unparseable reply and a missing API key all end with a person reviewing it,
 * which is where it would have been without any of this.
 */

export type ReviewOutcome = "approved" | "flagged" | "error" | "skipped";

type SubmissionRow = {
  id: string;
  kind: string;
  prompt_text: string | null;
  task_solved: string | null;
  time_saved_estimate: string | null;
  artefact_url: string | null;
  signoff_status: string;
  superseded_by: string | null;
  ai_reviewed_at: string | null;
  track_item_id: string | null;
  cohort_member_id: string;
};

export async function runAiReview(submissionId: string): Promise<ReviewOutcome> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    // No service-role key (any dev machine). Silently leave it for a human.
    return "skipped";
  }

  const { data: submission } = await supabase
    .from("programme_submissions")
    .select(
      "id, kind, prompt_text, task_solved, time_saved_estimate, artefact_url, signoff_status, superseded_by, ai_reviewed_at, track_item_id, cohort_member_id",
    )
    .eq("id", submissionId)
    .maybeSingle<SubmissionRow>();

  // Every one of these is a legitimate no-op, not an error: the sweep and the
  // after() callback can both reach the same row.
  if (
    !submission ||
    submission.signoff_status !== "pending" ||
    submission.superseded_by !== null ||
    submission.ai_reviewed_at !== null
  ) {
    return "skipped";
  }

  const { data: member } = await supabase
    .from("programme_cohort_members")
    .select("id, programme_cohorts!inner(review_mode)")
    .eq("id", submission.cohort_member_id)
    .maybeSingle<{ id: string; programme_cohorts: { review_mode: string } }>();

  if (member?.programme_cohorts.review_mode !== "ai_assisted") return "skipped";

  const { data: item } = submission.track_item_id
    ? await supabase
        .from("programme_track_items")
        .select("title")
        .eq("id", submission.track_item_id)
        .maybeSingle<{ title: string }>()
    : { data: null };

  const forReview: SubmissionForReview = {
    kind: submission.kind,
    slotTitle: item?.title ?? "Submission",
    promptText: submission.prompt_text,
    taskSolved: submission.task_solved,
    timeSavedEstimate: submission.time_saved_estimate,
    artefactUrl: submission.artefact_url,
  };

  let rawText = "";
  try {
    rawText = await askClaude(buildReviewPrompt(forReview), 2048);
  } catch (error) {
    await recordError(
      supabase,
      submission.id,
      error instanceof Error ? error.message : "unknown error",
    );
    return "error";
  }

  const review = parseReviewResponse(rawText);
  if (!review) {
    await recordError(supabase, submission.id, "could not parse the review");
    return "error";
  }

  // House style, in three passes and in this order. Ask again first, because
  // a rewrite fixes filler that no amount of find-and-replace can; then apply
  // the mechanical corrections to whatever survives; then record what is
  // still wrong so a bad prompt shows up in the numbers rather than only in
  // somebody's reading. Style never blocks a decision - a well-judged review
  // in slightly wrong English is still a well-judged review.
  const styled = await enforceStyle(review.feedback, forReview);
  review.feedback = styled.feedback;

  const { decision, reasons } = decideReview(review, forReview);
  const now = new Date().toISOString();
  const reviewJson = {
    ...review,
    reasons,
    model: CLAUDE_MODEL,
    reviewed_at: now,
    style: {
      rewritten: styled.rewritten,
      remaining: styled.remaining,
    },
  };

  if (decision === "approved") {
    const { data: applied } = await supabase
      .from("programme_submissions")
      .update({
        signoff_status: "approved",
        // Null on purpose: nobody signed this. The rubric says who did.
        signed_by: null,
        signed_at: now,
        signoff_rubric_json: { ...review.scores, reviewer: "ai" },
        signoff_comment: review.feedback,
        ai_review_json: reviewJson,
        ai_reviewed_at: now,
        ai_decision: "approved",
      })
      .eq("id", submission.id)
      // Re-checked at write time: the row may have been signed by a human in
      // the seconds the model took to answer, and the human wins.
      .eq("signoff_status", "pending")
      .is("ai_reviewed_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    // An approval can be the fifth signed example, which flips G3 and can be
    // the last thing between someone and their certificate. The human
    // sign-off action does this; without it here, an automatic approval
    // satisfies the gate in the data and nothing ever notices.
    //
    // Only when the write actually landed - if a human got there first, this
    // already ran on their path.
    if (applied) await maybeCompleteProgramme(submission.cohort_member_id, supabase);
    return "approved";
  }

  await supabase
    .from("programme_submissions")
    .update({
      ai_review_json: reviewJson,
      ai_reviewed_at: now,
      ai_decision: "flagged",
    })
    .eq("id", submission.id)
    .eq("signoff_status", "pending")
    .is("ai_reviewed_at", null);
  return "flagged";
}

type StyledFeedback = {
  feedback: string;
  /** Whether a second call was needed. Worth watching: a high rate means the prompt is not landing. */
  rewritten: boolean;
  /** Violations that survived both the rewrite and the mechanical fixes. */
  remaining: string[];
};

async function enforceStyle(
  original: string,
  submission: SubmissionForReview,
): Promise<StyledFeedback> {
  let feedback = original;
  let rewritten = false;

  const first = findStyleViolations(feedback);
  if (first.length > 0) {
    try {
      const retry = (
        await askClaude(
          buildFeedbackRewritePrompt(submission, feedback, describeViolations(first)),
        )
      ).trim();
      // Only take the rewrite if it is actually feedback and actually better.
      if (retry.length > 20 && findStyleViolations(retry).length < first.length) {
        feedback = retry;
        rewritten = true;
      }
    } catch {
      // A failed rewrite is not a failed review. Fall through to the fixes.
    }
  }

  feedback = applyStyleFixes(feedback);
  return {
    feedback,
    rewritten,
    remaining: findStyleViolations(feedback).map((v) => `${v.rule}:${v.found}`),
  };
}

async function recordError(
  supabase: ReturnType<typeof createAdminClient>,
  submissionId: string,
  message: string,
): Promise<void> {
  await supabase
    .from("programme_submissions")
    .update({
      ai_reviewed_at: new Date().toISOString(),
      ai_decision: "error",
      ai_review_json: { error: message },
    })
    .eq("id", submissionId)
    .eq("signoff_status", "pending")
    .is("ai_reviewed_at", null);
}

/**
 * The backstop: anything still unreviewed after the callback should have run.
 *
 * Bounded per run so one bad day cannot turn the nightly cron into a long
 * serial job; whatever is left is picked up tomorrow.
 */
export async function sweepUnreviewedSubmissions(limit = 50): Promise<number> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return 0;
  }

  // Test cohorts are excluded here rather than inside runAiReview, so a
  // rehearsal fixture never costs a model call. review_mode defaults to
  // ai_assisted on every cohort, the seeded ones included.
  const { data: rows } = await supabase
    .from("programme_submissions")
    .select(
      "id, programme_cohort_members!inner(programme_cohorts!inner(is_test))",
    )
    .eq("signoff_status", "pending")
    .is("ai_reviewed_at", null)
    .is("superseded_by", null)
    .eq("programme_cohort_members.programme_cohorts.is_test", false)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<{ id: string }[]>();

  let reviewed = 0;
  for (const row of rows ?? []) {
    const outcome = await runAiReview(row.id);
    if (outcome !== "skipped") reviewed += 1;
  }
  return reviewed;
}
