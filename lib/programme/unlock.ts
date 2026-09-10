/**
 * Which track items a member can see, and when.
 *
 * Four rules, in priority order:
 *
 *   1. The day-0 baseline check-in is ALWAYS available until it is answered,
 *      and complete once it is. It is the entry gate.
 *   2. Until a cohort_baseline response exists, NOTHING else is available.
 *      That is what makes the check-in mandatory rather than a suggestion.
 *   3. The FINAL measurement - the summative quiz and the post check-in -
 *      unlocks by date regardless of rules 2 and 2b, so someone who never did
 *      the baseline can still be measured at the end.
 *   4. Everything else unlocks on start_date + (day_index - 1) working days,
 *      at `PROGRAMME_OPEN_HOUR` London on that day - 07:00, see
 *      `openThroughInLondon`.
 *   4b. A day named in `DAY_HOLDS` stays shut past its own opening until the
 *      instant that entry states. It is the one-off override for a day whose
 *      content is not ready, and it expires on the clock rather than needing
 *      to be removed. Callers pass `heldDayIndexes` the same way they pass
 *      `today`, so this stays a pure function of its arguments.
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
 *
 * ## The two check-ins record themselves somewhere else
 *
 * Everything else on the track is completed by a `programme_item_progress`
 * row. The two check-ins are not: `submitAiScore` writes one row to
 * `ai_score_responses` and nothing to progress, so a member who has answered
 * one looks, to the progress map, exactly like a member who never has.
 *
 * Left to the date rules that means the day-0 item is "available" forever.
 * Nothing renders it - the timeline drops day 0 and the gate card disappears
 * the moment the response lands - but every count still sees it, so it sat in
 * "N things open", stayed permanently overdue (its unlock date IS the cohort
 * start), and `stepsToGreen` named it as the one thing between the member and
 * green. All twenty-five people across the two live cohorts who had done the
 * check-in were being told to finish a check-in they had already done and
 * could not find anywhere to do again.
 *
 * So `answeredCheckIns` is the missing signal, and it is deliberately NOT
 * `hasBaseline`: see the field.
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

/**
 * Which check-in wave each questionnaire item is completed by.
 *
 * The two entries are the whole of the "completion lives in another table"
 * problem described at the top of this file - every other item type on the
 * track writes progress when it is done.
 */
const CHECK_IN_WAVE_BY_TYPE = new Map<string, "baseline" | "post">([
  ["questionnaire_baseline", "baseline"],
  ["questionnaire_post", "post"],
]);

/** Whether the member has answered each check-in. See `answeredCheckIns`. */
export type AnsweredCheckIns = { baseline?: boolean; post?: boolean };

export function resolveItemStates<T extends TrackItemLike>(args: {
  items: readonly T[];
  startDate: IsoDate;
  /**
   * The date the programme is open THROUGH, which is not always today: days
   * open at 07:00 London, so before then it is yesterday. Callers get it from
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
   * Which check-ins the member has actually answered, so the two items whose
   * completion lives in `ai_score_responses` can be marked done.
   *
   * SEPARATE FROM `hasBaseline`, which is the same fact asked for a different
   * purpose and answered differently by two of the three callers. `hasBaseline`
   * decides VISIBILITY - rule 2, may this member open the programme at all -
   * and both the admin roster and the nightly RAG sweep pass `true`
   * unconditionally there, because they are measuring how late somebody's work
   * is rather than deciding what to render for them: a member who never
   * checked in is behind on everything, not excused from it. Reading that
   * `true` as "the check-in is done" would credit everyone who has not taken
   * it - six of the thirty-one live members when this was written - and green
   * out on the admin heatmap exactly the members who most need chasing.
   *
   * Defaults to neither answered, which leaves both items outstanding. That is
   * the pessimistic direction on purpose: a caller that has not been taught
   * about this cannot silently complete somebody's work.
   */
  answeredCheckIns?: AnsweredCheckIns;
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
  /**
   * Day indexes held shut past their own opening - rule 4b. From
   * `heldDayIndexes()` in working-days.ts, which reads the clock; passed in
   * rather than read here so this resolver stays pure and the tests can hold
   * a day without mocking time.
   *
   * Defaults to none held, which is the state the programme is in almost
   * always. A caller that has not been taught about holds therefore behaves
   * exactly as it did before, which is the wrong default for a hold that
   * matters and the right one for a resolver three surfaces share: a missing
   * hold shows a day early, a spurious one hides a day that is ready.
   */
  heldDayIndexes?: ReadonlySet<number>;
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

    // The same invariant, for the two items whose completion never reaches
    // `progressByItemId`. Read the response instead - see the header. It sits
    // here rather than beside the baseline branch below so that BOTH
    // check-ins answer to one rule, and above the date checks because an
    // answered check-in is done whatever the calendar says.
    const checkInWave = CHECK_IN_WAVE_BY_TYPE.get(item.type);
    if (checkInWave && args.answeredCheckIns?.[checkInWave]) {
      return { item, state: "complete", unlockDate };
    }

    // Rule 4b. Below both invariant branches on purpose: a hold shuts a day
    // that has not been opened yet, and never takes back work in progress.
    // Above everything else, because a held day is shut whatever the calendar
    // and the gates would otherwise say.
    if (args.heldDayIndexes?.has(item.day_index)) {
      return { item, state: "locked", unlockDate };
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
