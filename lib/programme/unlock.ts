/**
 * Which track items a member can see, and when.
 *
 * Four rules, in priority order:
 *
 *   1. The day-0 baseline check-in is ALWAYS available. It is the entry gate.
 *   2. Until a cohort_baseline response exists, NOTHING else is available.
 *      That is what makes the check-in mandatory rather than a suggestion.
 *   3. The FINAL measurement - the summative quiz and the post check-in -
 *      unlocks by date regardless of rules 2 and 2b, so someone who never did
 *      the baseline can still be measured at the end.
 *   4. Everything else unlocks on start_date + (day_index - 1) working days.
 *
 * And rule 2b, which is rule 2 one week later: until BOTH of week one's
 * submissions are in, nothing from week two onward unlocks. Week one is the
 * checkpoint the programme actually cares about - the "before" work sample is
 * a measurement that stops meaning anything once someone has had a week of
 * training, and the first signed example is the first evidence that any of
 * this reached their actual desk. Neither is worth collecting late.
 *
 * SUBMITTED, not approved. Sign-off routes to one person for the whole
 * cohort, so gating on approval would let a slow review queue hold twenty
 * people out of week two. The bar is that the work exists.
 *
 * And one invariant that overrides all of them: an item that has been started
 * or completed NEVER re-locks. Shift workers catch up whenever they can, and a
 * cohort whose start_date is corrected must not strand work already done.
 *
 * Rule 2 has one exception, `enforceBaselineGate`. See the field below.
 */

import {
  DEFAULT_UNLOCK_MODE,
  hasReached,
  unlockDateFor,
  weekOf,
  type IsoDate,
  type UnlockMode,
} from "./working-days";

export type ItemState = "locked" | "available" | "started" | "complete";

export type TrackItemLike = {
  id: string;
  type: string;
  day_index: number;
};

export type ResolvedItem<T extends TrackItemLike = TrackItemLike> = {
  item: T;
  state: ItemState;
  /** The date this item unlocks, for the "unlocks on X" label on locked days. */
  unlockDate: IsoDate;
};

/**
 * The post check-in ignores the baseline gate and unlocks purely by date.
 *
 * Quizzes used to be here too, as a whole type, and that was too broad: it
 * meant somebody who had skipped the mandatory check-in could walk straight
 * into an assessment. Weekly unlock made that vivid - the week-one quiz opened
 * on the cohort's first morning - but the exemption was always wrong in kind,
 * because it is meant to protect the FINAL measurement rather than leave a
 * side door into the programme. `summativeItemIds` names the quiz it actually
 * applies to.
 */
const GATE_EXEMPT_TYPES = new Set(["questionnaire_post"]);

/** Item types that ARE the baseline gate. */
const BASELINE_TYPES = new Set(["questionnaire_baseline"]);

export function resolveItemStates<T extends TrackItemLike>(args: {
  items: readonly T[];
  startDate: IsoDate;
  today: IsoDate;
  /** True once the member has a wave='cohort_baseline' response. */
  hasBaseline: boolean;
  /**
   * Whether week one's submissions are in - rule 2b.
   *
   * Defaults to TRUE, i.e. ungated, so every existing caller and test keeps
   * its behaviour and only a caller that has actually checked can shut week
   * two. The same defaulting reason as `enforceBaselineGate`, opposite
   * polarity, because this one names the satisfied state.
   */
  weekOneSubmissionsIn?: boolean;
  /**
   * Whether rule 2 applies. Defaults to true, and only a TEST cohort turns it
   * off.
   *
   * The gate exists so a cohort's before-and-after measurement always exists.
   * A test cohort is excluded from every report, so there is nothing to
   * measure and the gate can only do one thing: hold the sandbox shut on day
   * 0, which is precisely where the person checking it needs to get past.
   *
   * This is the same exception a test cohort already gets twice over -
   * `programme_sign_off` allows self-sign-off in one because a preview run has
   * one participant, and `enforce_single_active_cohort` ignores one because a
   * sandbox is not an enrolment. The alternative, seeding a baseline response
   * for the preview, is worse: `ai_score_responses` is unique on (email,
   * wave), so a fabricated row would consume the person's one real baseline
   * and their actual cohort would believe they had checked in with answers
   * they never gave.
   *
   * The cost, stated plainly: with this off you cannot preview the locked-out
   * day-0 experience itself. The day-0 card is still there and still links to
   * the check-in, so the screen is walkable - it just is not compulsory.
   */
  enforceBaselineGate?: boolean;
  /** Existing progress, by track item id. Absent means never touched. */
  progressByItemId?: ReadonlyMap<string, ItemState>;
  /**
   * The quiz (or quizzes) that measure the end of the programme, which are
   * exempt from the baseline gate for the same reason the post check-in is.
   * Everything else of type "quiz" is ordinary gated content.
   */
  summativeItemIds?: ReadonlySet<string>;
  /** Defaults to daily - see UnlockMode for the mode's history. */
  unlockMode?: UnlockMode;
}): ResolvedItem<T>[] {
  const progress = args.progressByItemId ?? new Map<string, ItemState>();
  const mode = args.unlockMode ?? DEFAULT_UNLOCK_MODE;

  return args.items.map((item) => {
    const unlockDate = unlockDateFor(args.startDate, item.day_index, mode);
    const recorded = progress.get(item.id);

    // Rule 5 (the invariant): work already begun stays visible, whatever the
    // dates or the gate now say.
    if (recorded === "complete" || recorded === "started") {
      return { item, state: recorded, unlockDate };
    }

    const dateReached = hasReached(unlockDate, args.today);

    if (BASELINE_TYPES.has(item.type)) {
      return { item, state: "available", unlockDate };
    }

    if (
      GATE_EXEMPT_TYPES.has(item.type) ||
      args.summativeItemIds?.has(item.id)
    ) {
      return {
        item,
        state: dateReached ? "available" : "locked",
        unlockDate,
      };
    }

    if (!args.hasBaseline && (args.enforceBaselineGate ?? true)) {
      return { item, state: "locked", unlockDate };
    }

    // Rule 2b. Sits AFTER the gate-exempt check above, so the post check-in
    // and the summative quiz stay reachable - a member who never submits week
    // one must still be measurable at the end, and locking day 15 behind day 1
    // would make G4 permanently unreachable rather than merely unmet.
    if (weekOf(item.day_index) > 1 && !(args.weekOneSubmissionsIn ?? true)) {
      return { item, state: "locked", unlockDate };
    }

    return { item, state: dateReached ? "available" : "locked", unlockDate };
  });
}

/** Items the member can act on right now. */
export function unlockedItems<T extends TrackItemLike>(
  resolved: readonly ResolvedItem<T>[],
): ResolvedItem<T>[] {
  return resolved.filter((r) => r.state !== "locked");
}

/** Unlocked items the member has not finished. Feeds RAG. */
export function outstandingItems<T extends TrackItemLike>(
  resolved: readonly ResolvedItem<T>[],
): ResolvedItem<T>[] {
  return resolved.filter(
    (r) => r.state === "available" || r.state === "started",
  );
}
