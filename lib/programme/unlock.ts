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
 *   4. Everything else unlocks on start_date + (day_index - 1) working days,
 *      at 09:00 London on that day - see `openThroughInLondon`.
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
  /**
   * The date the programme is open THROUGH, which is not always today: days
   * open at 09:00 London, so before then it is yesterday. Callers get it from
   * `openThroughInLondon`, never from `todayInLondon`.
   *
   * Still called `today` because it was exactly today for as long as days
   * opened at midnight, and renaming it would churn every test to say the
   * same thing. Read the name as "the day this resolver is standing on".
   */
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
   * Whether rule 2 applies. Defaults to true, and NOTHING in production turns
   * it off any more.
   *
   * It existed for preview runs: a test cohort is excluded from every report,
   * so the gate had nothing to measure there and could only strand the person
   * checking the programme on the day-0 card. That reasoning was sound and the
   * conclusion was still wrong. The one cohort anybody walks before launch
   * became the one cohort that did not behave like the real thing, so the
   * walkthrough reassured you about a programme that did not exist - and the
   * cost it avoided was three minutes of typing.
   *
   * The parameter stays because the tests need to exercise both sides of rule
   * 2, and because turning the gate off is a decision worth being able to make
   * explicitly rather than by editing the rule.
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
