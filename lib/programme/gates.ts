/**
 * The four completion gates, G1-G4.
 *
 * All four must pass for a member to complete the programme and earn a
 * certificate. Each is a pure function of already-loaded data so the whole set
 * is testable without a database and cheap to recompute on every render.
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
  g3: "Five signed examples approved",
  g4: "Final quiz passed and end-of-programme check-in done",
};

export type GateResult = {
  passed: boolean;
  /** Progress toward the gate, for the "3/5" style chip subtitle. */
  current: number;
  target: number;
};

export type GateSet = Record<GateId, GateResult>;

/** Number of approved signed examples (or equivalent) G3 requires. */
export const G3_REQUIRED_CREDITS = 5;

/** The most an approved capstone can substitute for. */
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
  /** Count of approved submissions with kind='signed_example'. */
  approvedSignedExamples: number;
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
 * G3's arithmetic is SUBSTITUTION, not addition.
 *
 * The playbook says five approved signed examples, "where an approved capstone
 * may count as up to 2". That means the capstone replaces up to two of the
 * five - so three examples plus a 2-credit capstone passes at exactly five.
 * Read additively (5 examples AND a capstone) the gate would be unreachable
 * for anyone who relied on the capstone, which is the opposite of its intent.
 */
export function g3Credits(
  approvedSignedExamples: number,
  capstoneCredits: number,
): number {
  return (
    approvedSignedExamples +
    Math.min(Math.max(capstoneCredits, 0), CAPSTONE_MAX_CREDITS)
  );
}

export function computeGates(input: GateInput): GateSet {
  const contentComplete = input.contentItemIds.filter((id) =>
    input.completedItemIds.has(id),
  ).length;

  const sessionsSatisfied = input.sessionItemIds.filter((id) =>
    input.satisfiedSessionItemIds.has(id),
  ).length;

  const credits = g3Credits(
    input.approvedSignedExamples,
    input.capstoneCredits,
  );

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
 * The routes still open to clearing G3.
 *
 * "3/5" is exact and says nothing about what to do next, because the gate's
 * arithmetic is substitution rather than addition: an approved capstone
 * replaces up to two of the five. Someone reading the number cannot tell
 * whether the shorter path is a fourth signed example or the capstone, and the
 * strip has no room to explain the rule in prose.
 *
 * So state the routes instead of the rule. Each one is a complete way to reach
 * five credits from where the member actually is, and the caller renders them
 * as the alternatives they are.
 *
 * Deliberately NOT a progress bar. The gate strip's own reasoning applies: a
 * member needs to know how many more, not roughly how far, and a filled track
 * would re-encode a number that is already on screen.
 */
export type G3Route = {
  /** Signed examples this route still needs approved. */
  examples: number;
  /** True when the route leans on the capstone for the rest. */
  capstone: boolean;
};

export function g3Routes(input: {
  approvedSignedExamples: number;
  capstoneCredits: number;
}): G3Route[] {
  const credits = g3Credits(
    input.approvedSignedExamples,
    input.capstoneCredits,
  );
  const short = G3_REQUIRED_CREDITS - credits;
  if (short <= 0) return [];

  const routes: G3Route[] = [{ examples: short, capstone: false }];

  // A capstone already counted cannot be spent twice, so it stops being an
  // alternative the moment it has credits. And when only one credit is
  // missing the capstone is not a second route, just a longer version of the
  // first - offering it there would be advice to do more work for nothing.
  if (input.capstoneCredits <= 0 && short > 1) {
    routes.push({
      examples: Math.max(0, short - CAPSTONE_MAX_CREDITS),
      capstone: true,
    });
  }

  return routes;
}
