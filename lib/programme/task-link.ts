/**
 * The link a member files against a day's Task.
 *
 * Stored on the member's own `programme_item_progress` row, under
 * `meta_json.output_url`, rather than in `programme_submissions`. The two look
 * interchangeable and are not:
 *
 *   - `programme_submissions.kind` is a CHECK-constrained enum of things that
 *     go through sign-off - the capstone and the two work samples, and the
 *     signed examples that live cohorts filed before those slots were
 *     removed. Every reader of that table filters on kind (see
 *     cohort-admin.ts, lead-board.ts, complete-action.ts), so a new kind would
 *     be invisible to all of them anyway, while the two readers that DON'T
 *     filter are the lead digest and the RAG sweep - where fifteen task links
 *     per member showing up is a bug, not a feature.
 *   - progress is already "this member's state on this item", which is exactly
 *     what a task link is. It needs no migration and no new RLS: the member
 *     owns the row, leads and admins can already read it.
 *
 * A filed link is now ALSO a G3 credit, which is the one thing here that
 * changed when the five "Example N" submission slots were removed. Those
 * slots were the gate's currency; without them the capstone alone caps G3 at
 * two of five and nobody completes. So the fifteen links became the currency
 * they were already collecting in all but name - see gates.ts:g3Credits.
 *
 * That makes it optional per DAY and not optional overall: no single task
 * demands a link, a task whose output is a spreadsheet on a shared drive is
 * still done in a click, but five of the fourteen days that offer the field
 * have to be filed to finish the programme. Worth knowing before writing copy
 * that calls it optional.
 */

/** Where the link lives inside `programme_item_progress.meta_json`. */
export const TASK_LINK_KEY = "output_url";

/**
 * The days whose Task has no link field at all.
 *
 * Not the same thing as the per-day optionality above. Those days ask for a
 * link and accept a blank; these days do not ask, and the field is not
 * rendered, because the work they describe produces nothing linkable - day 5
 * is settings on the member's own account, so the only honest answer to "paste
 * the link" is a screenshot or a fib, and a field that collects fibs is worse
 * than no field because you can no longer tell which is which.
 *
 * Consequences worth knowing before adding a day here:
 *
 *   - It costs a G3 credit's worth of CEILING, not of requirement. Fourteen
 *     linkable days against five required credits leaves plenty of room (see
 *     gates.ts:g3Credits), but empty this set out to five and the gate
 *     tightens.
 *   - The day is still completable - Mark complete sits next to the field and
 *     does the same thing - so G1 is untouched.
 *   - A link a member filed BEFORE the day joined this set stays in their
 *     meta_json and keeps its credit. It just stops being displayed. That is
 *     deliberate: revoking a credit somebody earned is worse than a row of
 *     data nothing reads.
 *   - Its task copy must not end "Submit ..." - see the exemption in
 *     tests/programme-track-spec.test.ts, which otherwise requires that line
 *     on every day.
 */
export const LINKLESS_TASK_DAYS: ReadonlySet<number> = new Set([5]);

/**
 * Whether a day's Task takes a filed link.
 *
 * Read server-side and passed to the card as a flag rather than exported to
 * the card directly, so the day numbers live in one module and the component
 * stays ignorant of them.
 */
export function taskTakesLink(dayIndex: number): boolean {
  return !LINKLESS_TASK_DAYS.has(dayIndex);
}

/** Matches the artefact_url cap on submissions. */
export const TASK_LINK_MAX_LENGTH = 2048;

/**
 * Cleans up what someone pasted, or returns null if it is not a link.
 *
 * Accepts a bare host ("claude.ai/share/abc") because that is what you get
 * copying out of the address bar on some browsers, and a member who pastes it
 * has done nothing wrong. Anything without a dot in it, or with whitespace in
 * the middle, is a typo rather than a URL and is rejected so the member finds
 * out now rather than when someone tries to open it.
 */
export function normaliseTaskLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > TASK_LINK_MAX_LENGTH) return null;
  if (/\s/.test(trimmed)) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  // http(s) only. A javascript: or data: URL would be rendered as an anchor
  // to whoever opens the member's row.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  if (url.href.length > TASK_LINK_MAX_LENGTH) return null;

  return url.href;
}

/** Reads the link back off a progress row's `meta_json`, defensively. */
export function taskLinkFrom(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[TASK_LINK_KEY];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * What the card shows instead of a 200-character URL.
 *
 * Host plus the tail of the path, so two links from the same member are
 * distinguishable at a glance without the row wrapping.
 */
export function shortenTaskLink(href: string, maxLength = 44): string {
  const display = href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (display.length <= maxLength) return display;
  const head = display.slice(0, Math.ceil(maxLength / 2) - 1);
  const tail = display.slice(-Math.floor(maxLength / 2));
  return `${head}…${tail}`;
}

/**
 * A member's filed links, keyed by track item.
 *
 * Shared by every caller that builds a GateInput - the member's page, the
 * completion latch, the admin cohort table, the nightly sweep - because they
 * must agree on the count. The latch is the thing that stamps somebody
 * complete, and a page showing five green gates over a latch that counted
 * four is exactly the failure resolveCompletedItemIds was written to end.
 *
 * Restricted to Tasks: saveTaskOutputLink refuses every other item type, so
 * this only ever agrees with it, and the count stays right if some later item
 * type starts writing to the same meta key.
 */
export function filedTaskLinksByItem(args: {
  /** Ids of the track's use_example items. */
  taskItemIds: ReadonlySet<string>;
  /** This member's progress meta_json, keyed by track item id. */
  metaByItemId: ReadonlyMap<string, unknown>;
}): Map<string, string> {
  const byItem = new Map<string, string>();
  for (const itemId of args.taskItemIds) {
    const link = taskLinkFrom(args.metaByItemId.get(itemId));
    if (link) byItem.set(itemId, link);
  }
  return byItem;
}

/**
 * One member's filed links, keyed by programme day.
 *
 * Pure, because the admin table that reads it is the only thing standing
 * between "everyone files a link" and "we think everyone files a link". A
 * missing day is a member to chase, so the shape has to be exact.
 */
export function taskLinksByDay(args: {
  /** The track's use_example items. */
  taskItems: readonly { id: string; day_index: number }[];
  /** This member's progress meta_json, keyed by track item id. */
  metaByItemId: ReadonlyMap<string, unknown>;
}): Record<number, string> {
  const byDay: Record<number, string> = {};
  for (const item of args.taskItems) {
    const link = taskLinkFrom(args.metaByItemId.get(item.id));
    if (link) byDay[item.day_index] = link;
  }
  return byDay;
}
