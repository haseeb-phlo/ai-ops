/**
 * Date arithmetic for the programme, in Europe/London working days.
 *
 * Everything here operates on plain "YYYY-MM-DD" strings rather than Date
 * objects. That is deliberate: a cohort's start_date is a Postgres `date` with
 * no time component, and unlock dates are calendar days, not instants. Round
 * -tripping those through Date introduces a timezone bug the moment the server
 * runs anywhere other than London - which on Vercel it does.
 *
 * No new dependency: `Intl.DateTimeFormat` with an en-CA locale yields
 * "YYYY-MM-DD" directly, and the rest is pure string/number arithmetic. Do not
 * reach for date-fns-tz.
 */

/** A calendar date as "YYYY-MM-DD". */
export type IsoDate = string;

const LONDON = "Europe/London";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date in Europe/London, as "YYYY-MM-DD".
 *
 * Takes an optional instant so callers (and tests) can be deterministic. Using
 * en-CA is the trick that makes Intl emit ISO order without manual padding.
 */
export function todayInLondon(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Days since the epoch for an ISO date. Timezone-free by construction. */
function toDayNumber(iso: IsoDate): number {
  if (!ISO_DATE_RE.test(iso)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${iso}"`);
  }
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

function fromDayNumber(day: number): IsoDate {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Day of week for an ISO date: 0 = Sunday … 6 = Saturday.
 * 1970-01-01 was a Thursday, hence the +4.
 */
export function dayOfWeek(iso: IsoDate): number {
  return (((toDayNumber(iso) + 4) % 7) + 7) % 7;
}

export function isWeekend(iso: IsoDate): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}

/**
 * Adds `count` WORKING days (Mon-Fri) to a date.
 *
 * `addWorkingDays(d, 0)` is the identity even when `d` is a weekend - it does
 * not roll forward. That matters because day 1 of a cohort is defined as
 * "start_date + 0 working days", and a cohort start_date is always a Monday
 * anyway; silently rolling would make an off-by-one invisible.
 *
 * Negative counts walk backwards, which the mid-cohort joiner grace period
 * needs.
 */
export function addWorkingDays(iso: IsoDate, count: number): IsoDate {
  let day = toDayNumber(iso);
  const step = count >= 0 ? 1 : -1;
  let remaining = Math.abs(count);
  while (remaining > 0) {
    day += step;
    if (!isWeekend(fromDayNumber(day))) remaining -= 1;
  }
  return fromDayNumber(day);
}

/**
 * Whole working days from `from` to `to`, counting the days strictly after
 * `from` up to and including `to`. Negative when `to` precedes `from`.
 *
 * Used for "how many working days has this member been in the cohort", which
 * drives the joiner grace period.
 */
export function workingDaysBetween(from: IsoDate, to: IsoDate): number {
  const a = toDayNumber(from);
  const b = toDayNumber(to);
  if (a === b) return 0;
  const step = b > a ? 1 : -1;
  let count = 0;
  for (let day = a + step; ; day += step) {
    if (!isWeekend(fromDayNumber(day))) count += step;
    if (day === b) break;
  }
  return count;
}

/**
 * How much of the programme opens at once.
 *
 *   "daily"  - one day at a time, the playbook's original drip.
 *   "weekly" - the whole week opens on its Monday.
 *
 * Weekly is the default, and the reasoning is worth keeping next to the code.
 * The real cadence of this programme is the three live sessions, one per week,
 * not the fifteen videos. Phlo runs shifts, so a daily lock stops someone who
 * has a quiet Tuesday and a brutal Wednesday from working when they can - and
 * the playbook already concedes the point by saying unlocked items never
 * re-lock and shift workers catch up whenever. A daily lock therefore adds
 * friction without adding structure.
 *
 * Weekly still drips: nobody can take all fifteen days on the first morning,
 * so the sessions still land in sequence and the spacing survives.
 */
export type UnlockMode = "daily" | "weekly";

export const DEFAULT_UNLOCK_MODE: UnlockMode = "weekly";

/** Which week (1-3) a programme day belongs to. */
export function weekOf(dayIndex: number): number {
  return Math.max(1, Math.ceil(dayIndex / 5));
}

/**
 * The date a given programme day unlocks.
 *
 * day_index 0 (the baseline check-in) is available from the cohort start.
 *
 * daily:  start_date + (N - 1) working days, so day 1 is the start Monday,
 *         day 5 the Friday of week 1 and day 15 the Friday of week 3.
 * weekly: the Monday of that day's week, so days 1-5 all open on the start
 *         Monday, 6-10 a week later and 11-15 a week after that.
 */
export function unlockDateFor(
  startDate: IsoDate,
  dayIndex: number,
  mode: UnlockMode = DEFAULT_UNLOCK_MODE,
): IsoDate {
  if (dayIndex <= 0) return startDate;
  if (mode === "weekly") {
    return addWorkingDays(startDate, (weekOf(dayIndex) - 1) * 5);
  }
  return addWorkingDays(startDate, dayIndex - 1);
}

/** True when `unlockDate` is today or in the past, in London terms. */
export function hasReached(unlockDate: IsoDate, today: IsoDate): boolean {
  return toDayNumber(unlockDate) <= toDayNumber(today);
}
