"use server";

import { requireWriter } from "@/lib/auth";
import { runReviewEval } from "@/lib/programme/review-eval-run";
import { evalPasses } from "@/lib/programme/review-evals";

/**
 * Runs the review eval against the deployment you are looking at.
 *
 * Not revalidating anything on purpose: this writes nothing and touches
 * nobody's submission. It reads back into the panel and is gone.
 */

export type EvalRunState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "done";
      passes: boolean;
      configuration: string;
      total: number;
      agreed: number;
      falseApprovals: number;
      falseFlags: number;
      errors: number;
      styleClean: number;
      rows: {
        id: string;
        expected: string;
        actual: string;
        agreed: boolean;
        falseApproval: boolean;
        reasons: string[];
        styleViolations: string[];
        feedback: string;
      }[];
    };

export async function runEval(
  _prev: EvalRunState,
  _formData: FormData,
): Promise<EvalRunState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can run the eval." };
  }

  try {
    const report = await runReviewEval();
    return {
      kind: "done",
      passes: evalPasses(report),
      configuration: report.configuration,
      total: report.total,
      agreed: report.agreed,
      falseApprovals: report.falseApprovals,
      falseFlags: report.falseFlags,
      errors: report.errors,
      styleClean: report.styleClean,
      rows: report.results.map((r) => ({
        id: r.id,
        expected: r.expected,
        actual: r.actual,
        agreed: r.agreed,
        falseApproval: r.falseApproval,
        reasons: r.reasons,
        styleViolations: r.styleViolations,
        feedback: r.feedback,
      })),
    };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "The eval could not run.",
    };
  }
}
