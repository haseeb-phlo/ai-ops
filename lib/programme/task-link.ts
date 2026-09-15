/**
 * The evidence a member files against a day's Task.
 *
 * Two shapes, one slot: a link to what they made, or - on the one day whose
 * work produces nothing linkable - a screenshot of it. Both live on the member's own
 * `programme_item_progress` row, under `meta_json`, rather than in
 * `programme_submissions`. The two look interchangeable and are not:
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
 *     what filed evidence is. It needs no migration and no new RLS: the member
 *     owns the row, leads and admins can already read it.
 *
 * Filed evidence is now ALSO a G3 credit, which is the one thing here that
 * changed when the five "Example N" submission slots were removed. Those
 * slots were the gate's currency; without them the capstone alone caps G3 at
 * two of five and nobody completes. So the fifteen days became the currency
 * they were already collecting in all but name - see gates.ts:g3Credits.
 *
 * That makes it optional per DAY and not optional overall: no single task
 * demands evidence, a task whose output is a spreadsheet on a shared drive is
 * still done in a click, but five of the fourteen days that offer the field
 * have to be filed to finish the programme. Worth knowing before writing copy
 * that calls it optional.
 *
 * ONE SLOT, NOT TWO. A day holds a link or a screenshot, never both: filing
 * either clears the other (and deletes the blob). Two would make the admin
 * table's cell ambiguous and the credit count arguable, for a case - "here is
 * the link AND a picture of it" - nobody has asked for.
 *
 * The screenshot is offered on ONE day, not on all of them - see
 * SCREENSHOT_TASK_DAYS. Both shapes still count for G3 wherever they exist,
 * because evidence filed under the old rule keeps its credit.
 */

/** Where the link lives inside `programme_item_progress.meta_json`. */
export const TASK_LINK_KEY = "output_url";

/** Where the screenshot's descriptor lives in the same bag. */
export const TASK_FILE_KEY = "output_file";

/** The private bucket holding filed screenshots. */
export const TASK_EVIDENCE_BUCKET = "programme-task-evidence";

/** 10 MB, matching the bucket's own `file_size_limit`. */
export const TASK_FILE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * What the upload accepts, matching the bucket's `allowed_mime_types`.
 *
 * HEIC/HEIF are in because that is what an iPhone screenshot arrives as, even
 * though no browser renders one - see `isPreviewableTaskFile`.
 */
export const TASK_FILE_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

/**
 * The extensions worth trusting when a browser declares no type at all.
 *
 * Which happens: a file picked from some Android file managers, and anything
 * dragged out of an archive, arrives with an empty `File.type`. Refusing
 * those would fail exactly the member who screenshotted on their phone, which
 * is the case this whole field exists for.
 */
const TASK_FILE_EXTENSION_MIME: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * The mime type to store for an upload, or null if it is not an image we take.
 *
 * A DECLARED type is never overridden. Only an empty one falls through to the
 * filename, so renaming a PDF to .png still fails - on the declared type
 * first, and on the bucket's `allowed_mime_types` after that.
 */
export function taskFileMime(file: { name: string; type: string }): string | null {
  const declared = file.type.trim().toLowerCase();
  if (declared) {
    return TASK_FILE_MIME_TYPES.includes(declared) ? declared : null;
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return TASK_FILE_EXTENSION_MIME[extension] ?? null;
}

/** A screenshot as recorded in `meta_json`. `path` is the source of truth. */
export type TaskFile = {
  /** Object path in TASK_EVIDENCE_BUCKET: `<member>/<item>/<uuid>`. */
  path: string;
  /** The filename the member uploaded, for display and download. */
  name: string;
  mime: string;
  size: number;
};

/** What one Task holds: a link, a screenshot, or nothing. */
export type TaskEvidence =
  | { kind: "link"; href: string }
  | { kind: "file"; file: TaskFile };

/** Matches the artefact_url cap on submissions. */
export const TASK_LINK_MAX_LENGTH = 2048;

/**
 * The days whose Task has no field at all.
 *
 * Not the same thing as the per-day optionality above. Those days offer a
 * field and accept a blank; these days do not ask, because the work they
 * describe produces nothing to show - day 5 is settings on the member's own
 * account.
 *
 * The screenshot half of this module is a standing argument for emptying this
 * set: "the only honest answer is a screenshot" was the reason day 5 had no
 * field, and a screenshot is now fileable. It is left as it is deliberately,
 * because that is a copy and gate decision (it raises the G3 ceiling and
 * changes the copy test's exemption) rather than a side effect of adding
 * uploads. Consequences worth knowing before changing it:
 *
 *   - It costs a G3 credit's worth of CEILING, not of requirement. Fourteen
 *     fileable days against five required credits leaves plenty of room (see
 *     gates.ts:g3Credits), but empty this set out to five and the gate
 *     tightens.
 *   - The day is still completable - Mark complete sits next to the field and
 *     does the same thing - so G1 is untouched.
 *   - Evidence a member filed BEFORE the day joined this set stays in their
 *     meta_json and keeps its credit. It just stops being displayed. That is
 *     deliberate: revoking a credit somebody earned is worse than a row of
 *     data nothing reads.
 *   - Its task copy must not end "Submit ..." - see the exemption in
 *     tests/programme-track-spec.test.ts, which otherwise requires that line
 *     on every day.
 */
export const LINKLESS_TASK_DAYS: ReadonlySet<number> = new Set([5]);

/**
 * Whether a day's Task takes filed evidence.
 *
 * Read server-side and passed to the card as a flag rather than exported to
 * the card directly, so the day numbers live in one module and the component
 * stays ignorant of them.
 */
export function taskTakesLink(dayIndex: number): boolean {
  return !LINKLESS_TASK_DAYS.has(dayIndex);
}

/**
 * The days that also offer a screenshot upload.
 *
 * Day 7 is Scheduled Tasks, and it is the reason the upload exists at all: a
 * Claude scheduled task has runs and no Share link, so the day was
 * uncompletable for anyone who did it properly. Most days produce something
 * linkable, and on those days a picture of the output is strictly worse
 * evidence than the output - whoever reads it later can open a link and
 * cannot open a screenshot.
 *
 * Day 14 is the second, added on 2026-09-15 when the day became the Outlook
 * extension, and it is day 7's argument rather than a loosening of it. Outlook
 * work has nothing to link twice over: a message has no address a colleague
 * can open, and the Claude for M365 add-ins keep their chat history in the
 * browser rather than in a Claude account, so there is no shareable chat
 * either. Checked against Anthropic's documentation the day it was added.
 *
 * So this is deliberately a short list rather than the inverse of
 * LINKLESS_TASK_DAYS. The upload shipped enabled on all fourteen linkable
 * days, which was the bug: it offered a worse option everywhere to solve a
 * problem that exists on two of them. A third entry should have to argue for
 * itself the way these two do, naming what it is about the day's output that
 * cannot be linked.
 *
 * A day in here must also be a linkable day - the link is still top billing on
 * day 7, with the upload worded as the fallback. `taskTakesFile` enforces that
 * rather than trusting the two sets to stay consistent by hand. Day 14 is the
 * one day where the copy leads with the screenshot instead, because there the
 * link is the exception rather than the norm; the field stays for the member
 * whose triage did produce something shareable.
 *
 * Evidence already filed on a day that is no longer in this set is NOT
 * revoked: it stays in the member's meta_json, keeps its G3 credit, and keeps
 * rendering on the card. Only the button to file a NEW one goes. Taking back a
 * credit somebody earned under the old rule would be worse than an option that
 * quietly stopped being offered - the same precedent LINKLESS_TASK_DAYS sets.
 */
export const SCREENSHOT_TASK_DAYS: ReadonlySet<number> = new Set([7, 14]);

/** Whether a day's Task offers the screenshot upload alongside the link. */
export function taskTakesFile(dayIndex: number): boolean {
  return taskTakesLink(dayIndex) && SCREENSHOT_TASK_DAYS.has(dayIndex);
}

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
 * Reads the screenshot descriptor back off `meta_json`, defensively.
 *
 * Every field is re-checked rather than cast. This is a JSON bag written by
 * an action that has changed shape once already, and a half-written
 * descriptor rendering as an <img> with `src=undefined` is a broken card on
 * somebody's completed day.
 */
export function taskFileFrom(meta: unknown): TaskFile | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[TASK_FILE_KEY];
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const path = row.path;
  if (typeof path !== "string" || path.length === 0) return null;
  return {
    path,
    name: typeof row.name === "string" && row.name ? row.name : "Screenshot",
    mime: typeof row.mime === "string" ? row.mime : "",
    size: typeof row.size === "number" ? row.size : 0,
  };
}

/**
 * The one reader every caller goes through.
 *
 * A link wins over a screenshot if both keys somehow hold a value. They never
 * should - each write clears the other - but a member who filed a link before
 * uploads existed and then uploads, on a build where the clear regressed,
 * should see the thing that opens rather than the thing that does not.
 */
export function taskEvidenceFrom(meta: unknown): TaskEvidence | null {
  const href = taskLinkFrom(meta);
  if (href) return { kind: "link", href };
  const file = taskFileFrom(meta);
  if (file) return { kind: "file", file };
  return null;
}

/**
 * Where the app serves a filed screenshot from.
 *
 * An app route rather than a stored URL: the bucket is private, so what a
 * browser can actually fetch is a signed URL that expires, and baking one
 * into a durable row (or into cached HTML) hands somebody a dead image a
 * minute later. The route mints a fresh one per request against the caller's
 * own session - see app/(protected)/learn/track/evidence.
 */
export function taskFileHref(file: TaskFile): string {
  return `/learn/track/evidence/${file.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * Whether a browser will render this inline, or only offer to download it.
 *
 * HEIC is the whole reason this exists: an iPhone screenshot uploads fine and
 * shows as a broken image everywhere but Safari, so the card checks first and
 * offers a download instead of a preview.
 */
export function isPreviewableTaskFile(file: TaskFile): boolean {
  return (
    file.mime === "image/png" ||
    file.mime === "image/jpeg" ||
    file.mime === "image/webp" ||
    file.mime === "image/gif"
  );
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
 * A member's filed evidence, keyed by track item.
 *
 * Shared by every caller that builds a GateInput - the member's page, the
 * completion latch, the admin cohort table, the nightly sweep - because they
 * must agree on the count. The latch is the thing that stamps somebody
 * complete, and a page showing five green gates over a latch that counted
 * four is exactly the failure resolveCompletedItemIds was written to end.
 *
 * One entry per item whichever shape it holds, so a link and a screenshot on
 * the same day can never count twice.
 *
 * Restricted to Tasks: the save actions refuse every other item type, so this
 * only ever agrees with them, and the count stays right if some later item
 * type starts writing to the same meta keys.
 */
export function filedTaskEvidenceByItem(args: {
  /** Ids of the track's use_example items. */
  taskItemIds: ReadonlySet<string>;
  /** This member's progress meta_json, keyed by track item id. */
  metaByItemId: ReadonlyMap<string, unknown>;
}): Map<string, TaskEvidence> {
  const byItem = new Map<string, TaskEvidence>();
  for (const itemId of args.taskItemIds) {
    const evidence = taskEvidenceFrom(args.metaByItemId.get(itemId));
    if (evidence) byItem.set(itemId, evidence);
  }
  return byItem;
}

/**
 * One member's filed evidence, keyed by programme day.
 *
 * Pure, because the admin table that reads it is the only thing standing
 * between "everyone files something" and "we think everyone files something".
 * A missing day is a member to chase, so the shape has to be exact - which is
 * also why a screenshot has to appear here. A day that only accepts pictures
 * showing a column of blanks is the same failure as not collecting it.
 */
export function taskEvidenceByDay(args: {
  /** The track's use_example items. */
  taskItems: readonly { id: string; day_index: number }[];
  /** This member's progress meta_json, keyed by track item id. */
  metaByItemId: ReadonlyMap<string, unknown>;
}): Record<number, TaskEvidence> {
  const byDay: Record<number, TaskEvidence> = {};
  for (const item of args.taskItems) {
    const evidence = taskEvidenceFrom(args.metaByItemId.get(item.id));
    if (evidence) byDay[item.day_index] = evidence;
  }
  return byDay;
}
