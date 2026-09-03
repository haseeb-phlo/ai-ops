/**
 * The four completion gates, G1-G4.
 *
 * All four must pass for a member to complete the programme and earn a
 * complete the programme. Each is a pure function of already-loaded data so
 * the whole set is testable without a database and cheap to recompute on every
 * render.
 */

export const GATE_IDS = ["g1", "g2", "g3", "g4"] as const;
export type GateId = (typeof GATE_IDS)[number];

export const GATE_LABEL: Record<GateId, string> = {
  g1: "Watched",
  g2: "Attended",
  g3: "Shared",
  g4: "Passed",
};

export const GATE_DESCRIPTION: Record<GateId, string> = {
  g1: "Every daily video and worked example complete",
  g2: "All three live sessions attended",
  g3: "Five pieces of work shared",
  g4: "Final quiz passed and end-of-programme check-in done",
};

export type GateResult = {
  passed: boolean;
  /** Progress toward the gate, for the "3/5" style chip subtitle. */
  current: number;
  target: number;
};

export type GateSet = Record<GateId, GateResult>;

/** Pieces of work G3 requires a member to have shared. */
export const G3_REQUIRED_CREDITS = 5;

/** The most an approved capstone is worth. */
export const CAPSTONE_MAX_CREDITS = 2;

export type GateInput = {
  /** Every video + use_example item id on the track. */
  contentItemIds: readonly string[];
  /** Item ids the member has completed. */
  completedItemIds: ReadonlySet<string>;
  /** Every session item id on the track. */
  sessionItemIds: readonly string[];
  /** Session item ids the member attended, or was excused from with a make-up. */
  satisfiedSessionItemIds: ReadonlySet<string>;
  /**
   * Count of approved submissions with kind='signed_example'.
   *
   * Always zero on a track seeded after the Example slots were removed. It
   * stays in the input because the cohorts that were running when they went
   * still have approved rows, and a member is not made to re-earn a credit
   * because the programme changed underneath them.
   */
  approvedSignedExamples: number;
  /**
   * Days whose Task has a link filed against it - one credit each. This is
   * the route every cohort seeded from the current spec takes; see
   * lib/programme/task-link.ts.
   */
  filedTaskLinks: number;
  /**
   * Credits an approved capstone contributes, from its sign-off rubric.
   * Clamped to CAPSTONE_MAX_CREDITS. Zero when there's no approved capstone.
   */
  capstoneCredits: number;
  /** Best score on the summative (week 3) quiz; null if never attempted. */
  bestSummativeQuizScore: number | null;
  /** Pass mark for that quiz, from its config_json - never hardcoded. */
  summativeQuizPassMark: number;
  /** True when a wave='post' response exists. */
  hasPostResponse: boolean;
};

/**
 * G3 counts PIECES OF WORK SHARED, from whichever of the three sources a
 * member has.
 *
 * A filed Task link is one credit, an approved signed example is one, and an
 * approved capstone is two. Plain addition, and that is a change: while the
 * five "Example N" slots existed the capstone SUBSTITUTED for up to two of
 * them, because the only other currency was an example and reading the two
 * additively would have put the gate out of reach for anyone relying on the
 * capstone.
 *
 * Removing those slots settles it the other way. A track seeded now asks for
 * no examples at all, so the capstone alone would cap the gate at 2 of 5 and
 * nobody would ever complete. Addition is the only reading under which both
 * populations can pass: the cohorts that were mid-flight keep every example
 * they had approved, and everyone else gets there by filing the links the
 * daily Task already asks for.
 */
export function g3Credits(input: {
  approvedSignedExamples: number;
  filedTaskLinks: number;
  capstoneCredits: number;
}): number {
  return (
    input.approvedSignedExamples +
    input.filedTaskLinks +
    Math.min(Math.max(input.capstoneCredits, 0), CAPSTONE_MAX_CREDITS)
  );
}

export function computeGates(input: GateInput): GateSet {
  const contentComplete = input.contentItemIds.filter((id) =>
    input.completedItemIds.has(id),
  ).length;

  const sessionsSatisfied = input.sessionItemIds.filter((id) =>
    input.satisfiedSessionItemIds.has(id),
  ).length;

  const credits = g3Credits(input);

  const quizPassed =
    input.bestSummativeQuizScore !== null &&
    input.bestSummativeQuizScore >= input.summativeQuizPassMark;

  return {
    g1: {
      passed:
        input.contentItemIds.length > 0 &&
        contentComplete === input.contentItemIds.length,
      current: contentComplete,
      target: input.contentItemIds.length,
    },
    g2: {
      passed:
        input.sessionItemIds.length > 0 &&
        sessionsSatisfied === input.sessionItemIds.length,
      current: sessionsSatisfied,
      target: input.sessionItemIds.length,
    },
    g3: {
      passed: credits >= G3_REQUIRED_CREDITS,
      current: Math.min(credits, G3_REQUIRED_CREDITS),
      target: G3_REQUIRED_CREDITS,
    },
    g4: {
      // Both halves required: passing the quiz without the post check-in
      // leaves the programme unmeasured, which is the thing the wave exists
      // for.
      passed: quizPassed && input.hasPostResponse,
      current: (quizPassed ? 1 : 0) + (input.hasPostResponse ? 1 : 0),
      target: 2,
    },
  };
}

export function allGatesPassed(gates: GateSet): boolean {
  return GATE_IDS.every((id) => gates[id].passed);
}

/**
 * How many more pieces of work the Shared gate still needs.
 *
 * This replaced a list of alternative ROUTES, and the reason it could is the
 * reason the routes existed. They were there because G3's arithmetic used to
 * be substitution: "3/5" was exact and still left a member unable to tell
 * whether the shorter path was a fourth example or the capstone, so the strip
 * spelled out each complete way to five.
 *
 * Now that every source adds, there is nothing left to disambiguate - one
 * more credit is one more piece of work, whichever kind it is. Offering the
 * capstone as an alternative would fail the routes' own honesty rule anyway:
 * it is worth two credits and costs a full submission and a sign-off, where
 * two Task links cost two pastes, so it is never the shorter road. It still
 * counts for anyone who does it; it is just not advice.
 *
 * Deliberately NOT a progress bar. A member needs to know how many more, not
 * roughly how far, and a filled track would re-encode a number already on
 * screen.
 */
export function g3Remaining(input: {
  approvedSignedExamples: number;
  filedTaskLinks: number;
  capstoneCredits: number;
}): number {
  return Math.max(0, G3_REQUIRED_CREDITS - g3Credits(input));
}
