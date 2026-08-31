/**
 * Which outstanding items are actually LATE.
 *
 * RAG used to count every unlocked-and-unfinished item. That was right while
 * unlock was daily and wrong the moment it became weekly: a member who did the
 * mandatory check-in on the first morning opened all of week one at once -
 * thirteen items - and `computeRag` turns red at five. So the reward for doing
 * the one thing the programme insists on was being told, immediately, that you
 * are "Behind".
 *
 * Unlock has since gone back to daily, which narrows the gap but does NOT
 * close it, so this module stays. Two reasons it still earns its place:
 * started and completed items never re-lock, so someone who worked ahead
 * carries unlocked future items around with them; and "available" and "late"
 * were always different questions, with RAG only ever meaning to ask the
 * second. Counting the first is how a member gets called behind for work that
 * is not due yet.
 *
 * An item is late once the day it belongs to has PASSED - strictly before
 * today, so nothing is ever late on the morning it opens. Day 1 is therefore
 * green all day for everyone, day 2 counts day 1's leftovers, and somebody who
 * catches up on Friday is green again by Friday evening.
 */

import { hasReached, unlockDateFor, type IsoDate } from "./working-days";

export type DatedItem = {
  /** The programme day this item belongs to. Day 0 is the entry gate. */
  dayIndex: number;
};

/**
 * True when this item's own day has already gone by.
 *
 * Passes "daily" explicitly rather than relying on the default. It matches the
 * default today, but under weekly a whole week shared one unlock date, so
 * reading the mode from configuration made all five days of a week fall late
 * together on the following Monday - the bug this module exists to avoid,
 * reintroduced one week later. Naming the mode here means the answer cannot
 * move again when the setting does.
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
