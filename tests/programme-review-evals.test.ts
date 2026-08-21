import { describe, it, expect } from "vitest";
import {
  EVAL_CASES,
  evalPasses,
  summariseEval,
  type EvalResult,
} from "@/lib/programme/review-evals";
import { decideReview, type AiReview } from "@/lib/programme/ai-review";
import { findStyleViolations } from "@/lib/programme/feedback-style";

/**
 * The offline layer of the eval.
 *
 * Each case is run through the real decision rule with a stubbed model
 * response - the scores a reasonable reviewer would give. That isolates the
 * rule from the model: if this fails, someone changed decideReview, not the
 * weather.
 *
 * The live layer (`npm run eval:review`) runs the same cases through the
 * actual model. It cannot live here because it needs credentials and costs
 * money per run.
 */

function stubbedReview(
  scores: Record<string, number>,
  over: Partial<AiReview> = {},
): AiReview {
  return {
    scores: scores as AiReview["scores"],
    feedback: "The role and context are clear. Name the columns so it runs unchanged.",
    concerns: [],
    confident: true,
    ...over,
  };
}

describe("eval set", () => {
  it("covers both outcomes, or it proves nothing", () => {
    expect(EVAL_CASES.some((c) => c.expect === "approved")).toBe(true);
    expect(EVAL_CASES.some((c) => c.expect === "flagged")).toBe(true);
  });

  it("has unique ids", () => {
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
  });

  it("scores every criterion on every case", () => {
    for (const c of EVAL_CASES) {
      for (const key of ["accuracy", "completeness", "usefulness", "reusability"]) {
        expect(c.plausibleScores[key], `${c.id}.${key}`).toBeTypeOf("number");
      }
    }
  });
});

describe("the decision rule against the eval set", () => {
  const results: EvalResult[] = EVAL_CASES.map((c) => {
    const review = stubbedReview(c.plausibleScores);
    const { decision, reasons } = decideReview(review, c.submission);
    return {
      id: c.id,
      expected: c.expect,
      actual: decision,
      agreed: decision === c.expect,
      falseApproval: c.expect === "flagged" && decision === "approved",
      reasons,
      styleViolations: findStyleViolations(review.feedback).map((v) => v.rule),
      feedback: review.feedback,
    };
  });

  for (const result of results) {
    const c = EVAL_CASES.find((e) => e.id === result.id)!;
    it(`${result.id}: ${c.about}`, () => {
      expect(result.actual).toBe(result.expected);
      if (c.requiredReason) {
        expect(result.reasons.join(" ")).toContain(c.requiredReason);
      }
    });
  }

  it("approves nothing it should have flagged", () => {
    // The asymmetric one. A false flag costs a human review; a false approval
    // is a gate that did not hold and nobody finds out.
    expect(results.filter((r) => r.falseApproval).map((r) => r.id)).toEqual([]);
  });

  it("passes its own bar", () => {
    expect(evalPasses(summariseEval(results))).toBe(true);
  });
});

describe("summariseEval", () => {
  const base: EvalResult = {
    id: "x",
    expected: "approved",
    actual: "approved",
    agreed: true,
    falseApproval: false,
    reasons: [],
    styleViolations: [],
    feedback: "fine",
  };

  it("counts the two directions separately", () => {
    const report = summariseEval([
      base,
      { ...base, id: "a", expected: "flagged", actual: "approved", agreed: false, falseApproval: true },
      { ...base, id: "b", expected: "approved", actual: "flagged", agreed: false },
    ]);
    expect(report.falseApprovals).toBe(1);
    expect(report.falseFlags).toBe(1);
    expect(report.agreed).toBe(1);
  });

  it("fails the run on a single false approval", () => {
    const report = summariseEval([
      { ...base, expected: "flagged", actual: "approved", agreed: false, falseApproval: true },
    ]);
    expect(evalPasses(report)).toBe(false);
  });

  it("fails the run on a style violation, however good the decisions", () => {
    const report = summariseEval([{ ...base, styleViolations: ["slop"] }]);
    expect(evalPasses(report)).toBe(false);
  });

  it("tolerates one false flag, because a human review is the cheap direction", () => {
    const report = summariseEval([
      base,
      { ...base, id: "b", expected: "approved", actual: "flagged", agreed: false },
    ]);
    expect(evalPasses(report)).toBe(true);
  });
});
