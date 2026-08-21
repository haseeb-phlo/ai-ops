/**
 * Wave-delta analysis.
 *
 * All pure: takes response rows, returns numbers. That matters here more than
 * anywhere else in the programme, because these figures are the ROI argument
 * that goes to the exec, and an arithmetic mistake in them is both invisible
 * and expensive.
 *
 * The load-bearing idea is the ORGANIC-DRIFT COMPARISON. A simple before/after
 * on the programme is weak evidence: people were getting better at AI anyway.
 * The May 2026 wave was captured three months before any training, so
 * may_2026 -> cohort_baseline measures improvement WITHOUT the programme, and
 * cohort_baseline -> post measures three weeks WITH it. Showing them side by
 * side is the difference between "people improved" and "the programme worked".
 *
 * Every same-people comparison is matched on EMAIL, never on user_id: May
 * respondents predate their auth account and some have never signed in.
 */

import {
  CAPABILITY_QUESTION_IDS,
  LIKERT_OPTIONS,
  type CapabilityQuestionId,
  type Wave,
} from "./questions";
import { HOURS_BANDS, type Answers } from "./score";

export type ResponseRow = {
  email: string;
  wave: Wave;
  team: string | null;
  functionName: string;
  cohortId: string | null;
  cohortName: string | null;
  answers: Answers;
  durationSeconds: number | null;
  flow: "returner" | "first_timer" | null;
};

/* ------------------------------------------------------------------ */
/* Capability mix                                                      */
/* ------------------------------------------------------------------ */

export type LevelCounts = [number, number, number, number, number];

export type CapabilityMixRow = {
  questionId: CapabilityQuestionId;
  before: LevelCounts;
  after: LevelCounts;
  beforeTotal: number;
  afterTotal: number;
};

function emptyLevels(): LevelCounts {
  return [0, 0, 0, 0, 0];
}

/**
 * For each of q1-q7, how many people sat at each 0-4 level in each wave.
 *
 * Counts rather than percentages, because the two waves can have different
 * numbers of respondents and a percentage hides that. The caller decides
 * whether to render a proportion, and has the denominator to do it honestly.
 */
export function capabilityMix(
  before: readonly ResponseRow[],
  after: readonly ResponseRow[],
): CapabilityMixRow[] {
  return CAPABILITY_QUESTION_IDS.map((questionId) => {
    const tally = (rows: readonly ResponseRow[]): [LevelCounts, number] => {
      const counts = emptyLevels();
      let total = 0;
      for (const row of rows) {
        const score = row.answers[questionId]?.score;
        if (typeof score !== "number" || score < 0 || score > 4) continue;
        counts[score] += 1;
        total += 1;
      }
      return [counts, total];
    };
    const [beforeCounts, beforeTotal] = tally(before);
    const [afterCounts, afterTotal] = tally(after);
    return {
      questionId,
      before: beforeCounts,
      after: afterCounts,
      beforeTotal,
      afterTotal,
    };
  });
}

/** "% who have shipped a Skill" - anyone at level 2 or above. */
export function proportionAtOrAbove(counts: LevelCounts, level: number): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const at = counts.slice(level).reduce((a, b) => a + b, 0);
  return Math.round((at / total) * 1000) / 10;
}

/* ------------------------------------------------------------------ */
/* Same-people deltas, and the organic-drift comparison                */
/* ------------------------------------------------------------------ */

export type SamePeopleDelta = {
  /** People with a response in BOTH waves. */
  matched: number;
  /** Mean capability average in each wave, across matched people only. */
  beforeMean: number | null;
  afterMean: number | null;
  delta: number | null;
  improved: number;
  unchanged: number;
  declined: number;
};

function capAverageOf(answers: Answers): number | null {
  const values = CAPABILITY_QUESTION_IDS.map(
    (q) => answers[q]?.score,
  ).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Change between two waves, for people who answered BOTH.
 *
 * Restricting to matched people is the whole point. Comparing all of wave A
 * against all of wave B confounds the change with who happened to respond, and
 * the May wave has 108 respondents against a cohort of a dozen.
 */
export function samePeopleDelta(
  before: readonly ResponseRow[],
  after: readonly ResponseRow[],
): SamePeopleDelta {
  const beforeByEmail = new Map(before.map((r) => [r.email.toLowerCase(), r]));

  let sumBefore = 0;
  let sumAfter = 0;
  let matched = 0;
  let improved = 0;
  let unchanged = 0;
  let declined = 0;

  for (const afterRow of after) {
    const beforeRow = beforeByEmail.get(afterRow.email.toLowerCase());
    if (!beforeRow) continue;
    const b = capAverageOf(beforeRow.answers);
    const a = capAverageOf(afterRow.answers);
    if (b === null || a === null) continue;

    matched += 1;
    sumBefore += b;
    sumAfter += a;
    if (a > b) improved += 1;
    else if (a < b) declined += 1;
    else unchanged += 1;
  }

  if (matched === 0) {
    return {
      matched: 0,
      beforeMean: null,
      afterMean: null,
      delta: null,
      improved: 0,
      unchanged: 0,
      declined: 0,
    };
  }

  const beforeMean = Math.round((sumBefore / matched) * 100) / 100;
  const afterMean = Math.round((sumAfter / matched) * 100) / 100;
  return {
    matched,
    beforeMean,
    afterMean,
    delta: Math.round((afterMean - beforeMean) * 100) / 100,
    improved,
    unchanged,
    declined,
  };
}

export type DriftComparison = {
  /** may_2026 -> cohort_baseline: what happened without any training. */
  organic: SamePeopleDelta;
  /** cohort_baseline -> post: three weeks of programme. */
  programme: SamePeopleDelta;
  /**
   * How much bigger the programme's effect was. Null when either leg has no
   * matched people, which is honest: with nobody in common there is no
   * comparison to make, and a zero would read as "no difference".
   */
  difference: number | null;
};

export function driftComparison(rows: readonly ResponseRow[]): DriftComparison {
  const byWave = (wave: Wave) => rows.filter((r) => r.wave === wave);
  const organic = samePeopleDelta(byWave("may_2026"), byWave("cohort_baseline"));
  const programme = samePeopleDelta(byWave("cohort_baseline"), byWave("post"));
  return {
    organic,
    programme,
    difference:
      organic.delta === null || programme.delta === null
        ? null
        : Math.round((programme.delta - organic.delta) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Confidence (q9-q15)                                                 */
/* ------------------------------------------------------------------ */

export const CONFIDENCE_QUESTION_IDS = [
  "q9",
  "q10",
  "q11",
  "q12",
  "q13",
  "q14",
  "q15",
] as const;

export type ConfidenceShiftRow = {
  questionId: string;
  beforeMean: number | null;
  afterMean: number | null;
  delta: number | null;
};

/** Likert answers scored 0-4 by position, so a mean is meaningful. */
function likertScore(value: string | undefined): number | null {
  if (!value) return null;
  const index = (LIKERT_OPTIONS as readonly string[]).indexOf(value);
  return index === -1 ? null : index;
}

export function confidenceShift(
  before: readonly ResponseRow[],
  after: readonly ResponseRow[],
): ConfidenceShiftRow[] {
  const meanFor = (rows: readonly ResponseRow[], qid: string): number | null => {
    const values = rows
      .map((r) => likertScore(r.answers[qid]?.value))
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  };

  return CONFIDENCE_QUESTION_IDS.map((questionId) => {
    const beforeMean = meanFor(before, questionId);
    const afterMean = meanFor(after, questionId);
    return {
      questionId,
      beforeMean,
      afterMean,
      delta:
        beforeMean === null || afterMean === null
          ? null
          : Math.round((afterMean - beforeMean) * 100) / 100,
    };
  });
}

/* ------------------------------------------------------------------ */
/* q19b band migration                                                 */
/* ------------------------------------------------------------------ */

export type BandMigration = {
  band: string;
  before: number;
  after: number;
};

/**
 * How the hours-saved bands moved.
 *
 * "can't estimate" is reported as its own row rather than folded in or
 * dropped: half the May respondents could not put a number on their saving,
 * and that count shrinking is itself one of the programme's outcomes.
 */
export function bandMigration(
  before: readonly ResponseRow[],
  after: readonly ResponseRow[],
): BandMigration[] {
  const bands = [...HOURS_BANDS, "can't estimate"];
  const count = (rows: readonly ResponseRow[], band: string) =>
    rows.filter((r) => r.answers.q19b?.value === band).length;
  return bands.map((band) => ({
    band,
    before: count(before, band),
    after: count(after, band),
  }));
}

/* ------------------------------------------------------------------ */
/* Completion telemetry                                                */
/* ------------------------------------------------------------------ */

export type FlowTelemetry = {
  flow: "returner" | "first_timer";
  responses: number;
  medianSeconds: number | null;
};

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function completionTelemetry(
  rows: readonly ResponseRow[],
): FlowTelemetry[] {
  return (["returner", "first_timer"] as const).map((flow) => {
    const durations = rows
      .filter((r) => r.flow === flow && typeof r.durationSeconds === "number")
      .map((r) => r.durationSeconds!);
    return { flow, responses: durations.length, medianSeconds: median(durations) };
  });
}

/**
 * The returner flow exists to make an unchanged submission take under a
 * minute. Six minutes means the pre-fill has stopped doing its job, and the
 * next wave's response rate will fall before anyone notices why.
 */
export const RETURNER_TRIPWIRE_SECONDS = 6 * 60;

export function returnerTripwireTripped(
  telemetry: readonly FlowTelemetry[],
): boolean {
  const returner = telemetry.find((t) => t.flow === "returner");
  return (
    returner?.medianSeconds !== null &&
    returner !== undefined &&
    returner.medianSeconds! > RETURNER_TRIPWIRE_SECONDS
  );
}
