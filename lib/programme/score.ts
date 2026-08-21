/**
 * Scoring and presentation logic for "Your AI Score".
 *
 * Scores are computed from the OPTION INDEX, server-side, and never in the
 * browser: the radar consumes numbers it is handed. A carried-forward answer
 * (one the returner didn't touch) scores exactly like a freshly given one -
 * it is a real answer, just an unchanged one.
 *
 * The delta rules here are the anti-fatigue mechanism, and they are the reason
 * this file exists rather than the arithmetic being inlined. Read the comment
 * on `deltaChipState` before changing anything about negatives.
 */

import {
  CAPABILITY_QUESTION_IDS,
  CAPABILITY_AXIS_LABEL,
  QUESTION_BY_ID,
  normalizeAnswerText,
  type CapabilityQuestionId,
} from "./questions";

/** One stored answer. `score` is only meaningful for capability questions. */
export type StoredAnswer = {
  value: string;
  score?: number | null;
  /** True when a returner left their previous wave's answer untouched. */
  carried_forward?: boolean;
};

export type Answers = Record<string, StoredAnswer>;

/**
 * The 0-4 score for an answer, from its position in the question's option
 * list. Returns null for anything that isn't a capability question, and for a
 * value that doesn't match an option (which the importer surfaces rather than
 * storing silently).
 */
export function scoreAnswer(qid: string, value: string): number | null {
  const question = QUESTION_BY_ID.get(qid);
  if (!question || question.kind !== "capability" || !question.options) {
    return null;
  }
  const index = question.options.indexOf(normalizeAnswerText(value));
  return index === -1 ? null : index;
}

/** Rebuilds every capability score in an answer set from its option index. */
export function withComputedScores(answers: Answers): Answers {
  const out: Answers = {};
  for (const [qid, answer] of Object.entries(answers)) {
    const score = scoreAnswer(qid, answer.value);
    out[qid] = score === null ? answer : { ...answer, score };
  }
  return out;
}

export type AxisScores = Partial<Record<CapabilityQuestionId, number>>;

/** Just the seven radar axes, in fixed order. */
export function axisScores(answers: Answers): AxisScores {
  const out: AxisScores = {};
  for (const qid of CAPABILITY_QUESTION_IDS) {
    const answer = answers[qid];
    if (!answer) continue;
    const score = answer.score ?? scoreAnswer(qid, answer.value);
    if (typeof score === "number") out[qid] = score;
  }
  return out;
}

/**
 * Mean capability score, 0-4, rounded to one decimal. Null when no axis has
 * been answered - a headline of "0.0 / 4" would read as a result rather than
 * as missing data.
 */
export function capAverage(scores: AxisScores): number | null {
  const values = CAPABILITY_QUESTION_IDS.map((q) => scores[q]).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* The delta chip                                                      */
/* ------------------------------------------------------------------ */

export type DeltaChipState =
  | { kind: "none" }
  | { kind: "up"; delta: number; label: string }
  | { kind: "flat"; delta: 0; label: string }
  | { kind: "down"; delta: number; label: string };

/**
 * How to render the change since the previous wave.
 *
 * The negative case is the important one. An honest self-assessment that goes
 * DOWN after training is the Dunning-Kruger correction - someone who now knows
 * what "using Skills well" actually means and rates themselves accordingly.
 * That is learning, not failure. So a drop renders NEUTRAL GREY and is worded
 * "recalibrated": never red, never a minus-styled warning, never anything that
 * reads as a telling-off. Get this wrong and people learn to game the next
 * wave upward, which destroys the instrument.
 *
 * With no prior wave there is no chip at all - "+1.9 since never" is nonsense.
 */
export function deltaChipState(
  current: number | null,
  previous: number | null,
  previousLabel: string,
): DeltaChipState {
  if (current === null || previous === null) return { kind: "none" };

  const delta = Math.round((current - previous) * 10) / 10;

  if (delta > 0) {
    return { kind: "up", delta, label: `+${delta.toFixed(1)} since ${previousLabel}` };
  }
  if (delta === 0) {
    return { kind: "flat", delta: 0, label: `No change since ${previousLabel}` };
  }
  return {
    kind: "down",
    delta,
    label: `Recalibrated since ${previousLabel}`,
  };
}

/* ------------------------------------------------------------------ */
/* The insight sentence                                                */
/* ------------------------------------------------------------------ */

/**
 * Where each axis is taught. Drives the one-line insight, which is
 * RULE-GENERATED - no LLM call. The sentence renders on every submit, so it
 * has to be instant, free, and identical for the same input.
 */
export const AXIS_COVERAGE: Record<CapabilityQuestionId, string> = {
  q1: "Week 1 covers it",
  q2: "Week 1 covers it",
  q3: "Week 3 covers it",
  q4: "Week 2 covers it",
  q5: "Week 1 covers it",
  q6: "Week 2 covers it",
  q7: "it's where your training lives",
};

/**
 * Highest and lowest axis. Ties break to the LOWEST q-number, so the sentence
 * is deterministic - the same answers always produce the same advice.
 */
export function strongestAndWeakest(scores: AxisScores): {
  strongest: CapabilityQuestionId | null;
  weakest: CapabilityQuestionId | null;
} {
  let strongest: CapabilityQuestionId | null = null;
  let weakest: CapabilityQuestionId | null = null;

  // CAPABILITY_QUESTION_IDS is already in q-number order, and strict
  // comparisons mean the first (lowest-numbered) extreme wins a tie.
  for (const qid of CAPABILITY_QUESTION_IDS) {
    const value = scores[qid];
    if (typeof value !== "number") continue;
    if (strongest === null || value > scores[strongest]!) strongest = qid;
    if (weakest === null || value < scores[weakest]!) weakest = qid;
  }
  return { strongest, weakest };
}

export function insightSentence(scores: AxisScores): string | null {
  const { strongest, weakest } = strongestAndWeakest(scores);
  if (!strongest || !weakest) return null;

  // Everything level: there is no "biggest opportunity" to name.
  if (scores[strongest] === scores[weakest]) {
    return `Evenly spread across all seven areas - ${AXIS_COVERAGE[weakest]}.`;
  }

  return `Strongest: ${CAPABILITY_AXIS_LABEL[strongest]}. Biggest opportunity: ${CAPABILITY_AXIS_LABEL[weakest]} - ${AXIS_COVERAGE[weakest]}.`;
}

/* ------------------------------------------------------------------ */
/* Screen 2: the day-15 graduation moment                              */
/* ------------------------------------------------------------------ */

/**
 * Axes that moved from "didn't know it existed" (0-1) to "actually using it"
 * (>=2). Phrased as achievements on the result screen, which is the single
 * most motivating thing on it.
 */
export function newlyAcquiredAxes(
  before: AxisScores,
  after: AxisScores,
): CapabilityQuestionId[] {
  return CAPABILITY_QUESTION_IDS.filter((qid) => {
    const from = before[qid];
    const to = after[qid];
    return (
      typeof from === "number" &&
      typeof to === "number" &&
      from <= 1 &&
      to >= 2
    );
  });
}

export const ACHIEVEMENT_PHRASE: Record<CapabilityQuestionId, string> = {
  q1: "You're writing structured prompts",
  q2: "You're working in Projects",
  q3: "You shipped your first Artefact",
  q4: "You've got Scheduled Tasks running",
  q5: "You're using Connectors",
  q6: "You shipped your first Skill",
  q7: "You're using AI Ops properly",
};

/** Ordered hours-saved bands. Index is the band's rank for shift comparisons. */
export const HOURS_BANDS = [
  "0",
  "under 1",
  "1-3",
  "3-5",
  "5-10",
  "10+",
] as const;

/**
 * Movement between q19b bands. "can't estimate" has no rank, so any
 * comparison involving it returns null rather than inventing a direction.
 */
export function hoursBandShift(
  before: string | null,
  after: string | null,
): { from: string; to: string; steps: number } | null {
  if (!before || !after) return null;
  const from = HOURS_BANDS.indexOf(before as (typeof HOURS_BANDS)[number]);
  const to = HOURS_BANDS.indexOf(after as (typeof HOURS_BANDS)[number]);
  if (from === -1 || to === -1) return null;
  return { from: before, to: after, steps: to - from };
}
