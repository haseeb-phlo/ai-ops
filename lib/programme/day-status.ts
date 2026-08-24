/**
 * What one day of the timeline is doing, as a single word.
 *
 * Both the focus card and the timeline rows need this, and they were deriving
 * it separately - `day-focus.tsx` with a five-way `statusOf`, `day-row.tsx`
 * with its own `allLocked` / `allComplete` pair. Two derivations of one rule is
 * how a day comes to read "done" on the rail and "open" in the list, so the
 * rule lives here and both read it.
 *
 * The order matters and is not alphabetical:
 *
 *   1. Nothing actionable yet -> `locked`. Checked first, because a locked day
 *      is locked whatever its contents are waiting on.
 *   2. Nothing left that the member can DO -> `awaiting`. A day whose only
 *      content is a video we have not recorded is waiting on us, not on them.
 *      Calling it complete credits them with something they could not do;
 *      calling it outstanding blames them for our backlog.
 *   3. Everything actionable finished -> `complete`.
 *   4. Otherwise open, and `current` if it is today.
 */

export type DayStatus =
  | "complete"
  | "current"
  | "open"
  | "locked"
  | "awaiting";

export type DayItemLike = {
  state: string;
  /** True for a video day with nothing recorded against it yet. */
  awaitingVideo?: boolean;
};

export function dayStatus(
  items: readonly DayItemLike[],
  isToday: boolean,
): DayStatus {
  // An empty day has nothing to unlock, so it reads as locked rather than as a
  // day someone has finished.
  if (items.every((i) => i.state === "locked")) return "locked";

  const actionable = items.filter((i) => !i.awaitingVideo);
  if (actionable.length === 0) return "awaiting";
  if (actionable.every((i) => i.state === "complete")) return "complete";

  return isToday ? "current" : "open";
}

/**
 * The connecting spine below a day's marker.
 *
 * It carries TWO independent facts, because they are independent in life:
 * colour is the member's progress, and a dashed stroke is OUR content debt.
 *
 * A spine carrying a semantic colour is already the house grammar - the
 * styling rules give `--destructive` "dots, spines, solid marks" - so the
 * colour half is the status dot's rule applied to a line, not a new use of
 * colour.
 *
 * The dash is the half worth explaining. The obvious version was to give the
 * whole day an `awaiting` status, and it is wrong twice over: every day also
 * carries a "try it yourself" exercise, so a day missing its video is still
 * workable rather than blocked, and because `awaiting` requires NOTHING
 * actionable to remain, it would in practice never fire on this track at all.
 * A dash layered over the real status says the true thing instead - "there is
 * still something owed on this day" - without claiming the day is finished or
 * that it is stuck.
 *
 * Purely decorative: every item already states its own status in text, the
 * card for an unrecorded day already says "Video coming soon", and the spine
 * is `aria-hidden`. Nothing here is the only carrier of anything.
 */
const DAY_SPINE_COLOUR: Record<DayStatus, string> = {
  complete: "border-success",
  current: "border-primary",
  open: "border-muted-foreground/40",
  locked: "border-border",
  awaiting: "border-border",
};

/** True when any of the day's items is still waiting on a recording. */
export function dayAwaitsContent(items: readonly DayItemLike[]): boolean {
  return items.some((i) => i.awaitingVideo === true);
}

export function daySpine(
  status: DayStatus,
  awaitsContent: boolean,
): string {
  // A locked day's gaps are nobody's problem yet, and dashing a long run of
  // future days would turn a real signal into wallpaper.
  if (awaitsContent && status !== "locked") {
    return `border-dashed ${DAY_SPINE_COLOUR[status]}`;
  }
  return DAY_SPINE_COLOUR[status];
}
