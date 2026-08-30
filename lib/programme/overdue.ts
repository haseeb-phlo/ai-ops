/**
 * Which outstanding items are actually LATE.
 *
 * RAG used to count every unlocked-and-unfinished item, which was right while
 * unlock was daily and wrong the moment it became weekly. Under weekly unlock
 * a member who completes the mandatory check-in on the first morning opens all
 * of week one at once - thirteen items on the current track - and
 * `computeRag` turns red at five. So the reward for doing the one thing the
 * programme insists on was being told, immediately, that you are "Behind".
 *
 * The fix is not a bigger threshold. It is that "available" and "late" are
 * different questions, and RAG only ever meant to ask the second one. Access
 * stays weekly, because shift workers need to work when they can; the clock
 * stays daily, because that is the pace the programme is actually asking for.
 *
 * An item is late once the day it belongs to has PASSED - strictly before
 * today, so nothing is ever late on the morning it opens. Day 1 is therefore
 * green all day for everyone, day 2 counts day 1's leftovers, and somebody who
 * takes the whole week on Friday is green again by Friday evening.
 */

import { hasReached, unlockDateFor, type IsoDate } from "./working-days";

export type DatedItem = {
  /** The programme day this item belongs to. Day 0 is the entry gate. */
  dayIndex: number;
};

/**
 * True when this item's own day has already gone by.
 *
 * Deliberately uses DAILY arithmetic even though access is weekly: a whole
 * week shares one unlock date, so asking `unlockDateFor` in weekly mode would
 * make all five days of a week become late together, on the Monday of the
 * next one. That is the bug this module exists to avoid, one week later.
 */
export function isOverdue(args: {
  dayIndex: number;
  startDate: IsoDate;
  today: IsoDate;
}): boolean {
  const dueOn = unlockDateFor(args.startDate, args.dayIndex, "daily");
  // Today is not late. Everything before it is.
  return dueOn !== args.today && hasReached(dueOn, args.today);
}

/** How many of these outstanding items are late. Feeds RAG. */
export function countOverdue(
  items: readonly DatedItem[],
  args: { startDate: IsoDate; today: IsoDate },
): number {
  return items.filter((i) =>
    isOverdue({ dayIndex: i.dayIndex, startDate: args.startDate, today: args.today }),
  ).length;
}

/** The late ones themselves, for "what would clear this" messaging. */
export function overdueOnly<T extends DatedItem>(
  items: readonly T[],
  args: { startDate: IsoDate; today: IsoDate },
): T[] {
  return items.filter((i) =>
    isOverdue({ dayIndex: i.dayIndex, startDate: args.startDate, today: args.today }),
  );
}
