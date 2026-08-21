import "server-only";
import { askClaude, CLAUDE_MODEL, claudeStatus } from "@/lib/anthropic";
import {
  buildFeedbackRewritePrompt,
  buildReviewPrompt,
  decideReview,
  parseReviewResponse,
} from "./ai-review";
import {
  applyStyleFixes,
  describeViolations,
  findStyleViolations,
} from "./feedback-style";
import {
  EVAL_CASES,
  summariseEval,
  type EvalReport,
  type EvalResult,
} from "./review-evals";

/**
 * The live eval: the real model, the real prompt, the real style pass.
 *
 * Run from /learn/admin rather than a local script, deliberately. A script on
 * a laptop tells you the prompt works against whatever credentials that
 * laptop has. Running it in the deployment tells you the thing that is
 * actually reviewing people's work is behaving - the right provider, the
 * right model id, the right region, the right prompt. That is the question
 * worth answering, and it is the one that goes wrong.
 *
 * So this doubles as the configuration check: if Vertex is misconfigured
 * every case comes back an error, immediately and visibly, rather than
 * quietly at 2am when someone submits their first prompt.
 *
 * Costs two model calls per case at most, sixteen for the set. Run it after a
 * prompt edit, a model bump or a provider change, and once before a cohort
 * starts.
 */

export type LiveEvalReport = EvalReport & {
  /** Which provider and model actually answered. */
  configuration: string;
  model: string;
};

export async function runReviewEval(): Promise<LiveEvalReport> {
  const results: EvalResult[] = [];

  for (const testCase of EVAL_CASES) {
    let raw: string;
    try {
      raw = await askClaude(buildReviewPrompt(testCase.submission));
    } catch (error) {
      results.push(errorResult(testCase.id, testCase.expect, error));
      continue;
    }

    const review = parseReviewResponse(raw);
    if (!review) {
      results.push(
        errorResult(testCase.id, testCase.expect, new Error("unparseable reply")),
      );
      continue;
    }

    // The same style pass production runs, because feedback quality is half
    // of what this eval is for.
    let feedback = review.feedback;
    const violations = findStyleViolations(feedback);
    if (violations.length > 0) {
      try {
        const retry = (
          await askClaude(
            buildFeedbackRewritePrompt(
              testCase.submission,
              feedback,
              describeViolations(violations),
            ),
          )
        ).trim();
        if (retry.length > 20 && findStyleViolations(retry).length < violations.length) {
          feedback = retry;
        }
      } catch {
        // Style retry failing does not invalidate the decision under test.
      }
    }
    feedback = applyStyleFixes(feedback);

    const { decision, reasons } = decideReview(
      { ...review, feedback },
      testCase.submission,
    );

    results.push({
      id: testCase.id,
      expected: testCase.expect,
      actual: decision,
      agreed: decision === testCase.expect,
      falseApproval: testCase.expect === "flagged" && decision === "approved",
      reasons,
      styleViolations: findStyleViolations(feedback).map((v) => `${v.rule}:${v.found}`),
      feedback,
    });
  }

  return {
    ...summariseEval(results),
    configuration: claudeStatus(),
    model: CLAUDE_MODEL,
  };
}

function errorResult(
  id: string,
  expected: "approved" | "flagged",
  error: unknown,
): EvalResult {
  return {
    id,
    expected,
    actual: "error",
    agreed: false,
    falseApproval: false,
    reasons: [error instanceof Error ? error.message : "unknown error"],
    styleViolations: [],
    feedback: "",
  };
}
