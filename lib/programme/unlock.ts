/**
 * Which track items a member can see, and when.
 *
 * Four rules, in priority order:
 *
 *   1. The day-0 baseline check-in is ALWAYS available. It is the entry gate.
 *   2. Until a cohort_baseline response exists, NOTHING else is available.
 *      That is what makes the check-in mandatory rather than a suggestion.
 *   3. The day-15 quiz and post check-in unlock BY DATE regardless of rule 2,
 *      so someone who never did the baseline can still be measured at the end.
 *   4. Everything else unlocks on start_date + (day_index - 1) working days.
 *
 * And one invariant that overrides all of them: an item that has been started
 * or completed NEVER re-locks. Shift workers catch up whenever they can, and a
 * cohort whose start_date is corrected must not strand work already done.
 */

import {
  hasReached,
  unlockDateFor,
  type IsoDate,
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

/** Item types that ignore the baseline gate and unlock purely by date. */
const GATE_EXEMPT_TYPES = new Set(["quiz", "questionnaire_post"]);

/** Item types that ARE the baseline gate. */
const BASELINE_TYPES = new Set(["questionnaire_baseline"]);

export function resolveItemStates<T extends TrackItemLike>(args: {
  items: readonly T[];
  startDate: IsoDate;
  today: IsoDate;
  /** True once the member has a wave='cohort_baseline' response. */
  hasBaseline: boolean;
  /** Existing progress, by track item id. Absent means never touched. */
  progressByItemId?: ReadonlyMap<string, ItemState>;
}): ResolvedItem<T>[] {
  const progress = args.progressByItemId ?? new Map<string, ItemState>();

  return args.items.map((item) => {
    const unlockDate = unlockDateFor(args.startDate, item.day_index);
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

    if (GATE_EXEMPT_TYPES.has(item.type)) {
      return {
        item,
        state: dateReached ? "available" : "locked",
        unlockDate,
      };
    }

    if (!args.hasBaseline) {
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
