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
 * The hour a programme day opens, in London time.
 *
 * Days used to open at midnight, because that is what a bare date comparison
 * gives you for free - and nobody chose it. The effect was that a day arrived
 * while everyone was asleep, so anyone glancing at the app late the night
 * before found tomorrow's work already sitting there. That is what moving to
 * an explicit hour fixed, and it is the part that must not be undone.
 *
 * The hour itself was 9, on the reasoning that nine is when the working day
 * starts. That reasoning does not hold at Phlo, and the constant it produced
 * had the same shape of bug as midnight did, one shift over: the dispensary
 * and fulfilment mornings begin at 7, so the people whose day starts earliest
 * met a programme that would not open for another two hours. Seven is when
 * the earliest working day here actually starts.
 *
 * Nothing about the invariant changed - a day still opens at a stated local
 * hour, and still does not arrive overnight. Only the hour moved.
 *
 * `MEMBER_REMINDER_HOUR` in the programme-notify cron STAYED at 9, so the two
 * numbers now differ on purpose. They were the same number for the same
 * reason and are not bound by import, and the reason they were the same was
 * that the Monday nudge must not land AHEAD of the open - telling somebody to
 * go and do work they cannot yet see. At 9 against a 7am open the nudge lands
 * two hours after it, which satisfies that just as well, and a 7am DM does
 * not. If you move this constant again, go and look at that one: what has to
 * hold is `MEMBER_REMINDER_HOUR >= PROGRAMME_OPEN_HOUR`, not equality.
 */
export const PROGRAMME_OPEN_HOUR = 7;

/** How that hour is written on screen. One spelling, in one place. */
export const PROGRAMME_OPEN_LABEL = "7am";

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

/**
 * The hour of day (0-23) in Europe/London.
 *
 * Vercel schedules crons in UTC, and London is UTC+1 for half the year, so a
 * fixed UTC hour drifts by one hour across the DST boundary. A job that has to
 * land at a stated local time therefore runs on both candidate UTC hours and
 * uses this to decide which firing is the real one.
 */
export function hourInLondon(now: Date = new Date()): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  // Some engines render midnight as "24" under hour12:false. Irrelevant to the
  // 3pm/4pm firings this was written for, but it is a shared helper now and a
  // function that can return 24 for midnight is a trap for the next caller.
  return hour % 24;
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
 * DAILY is the default. Weekly was tried and reverted, and the history is
 * worth keeping because a good deal of code downstream was written against it.
 *
 * The case for weekly was that Phlo runs shifts, so a daily lock stops someone
 * with a quiet Tuesday and a brutal Wednesday from working when they can. That
 * is a real cost, but it is already paid for elsewhere: an item that has been
 * started or completed never re-locks, so anyone who gets ahead stays ahead,
 * and nobody who falls behind loses access to what they missed.
 *
 * What weekly cost in exchange was the shape of the thing. Fifteen days that
 * open five at a time is three chapters, not fifteen days - the first morning
 * presented thirteen items and four videos for days that had not happened, and
 * a programme that says "about ten minutes a day" stopped looking like one.
 *
 * Two modules exist because of the weekly experiment and both stay, because
 * both are right under daily too: `overdue.ts` separates "open" from "late",
 * and the quiz gate exemption in unlock.ts is narrowed to the summative quiz
 * alone. See each for its own reasoning.
 */
export type UnlockMode = "daily" | "weekly";

export const DEFAULT_UNLOCK_MODE: UnlockMode = "daily";

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
 *
 * A date, not an instant. The time of day a date opens at is
 * `PROGRAMME_OPEN_HOUR`, and the only thing that applies it is
 * `openThroughInLondon` - so this stays pure calendar arithmetic and the
 * whole module keeps working in plain "YYYY-MM-DD" strings.
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

/**
 * The date the programme is open THROUGH, at instant `now`.
 *
 * From `PROGRAMME_OPEN_HOUR` London this is today; before it, the previous
 * calendar day. Pass it wherever unlock is being decided - `resolveItemStates`
 * and friends - and keep `todayInLondon` for everything that asks which day it
 * is rather than what has opened: overdue, RAG, the "Today" badge on the
 * timeline. Those two questions were the same question while days opened at
 * midnight and are not any more, and conflating them would quietly move the
 * overdue line to the open hour too.
 *
 * Steps back a CALENDAR day rather than a working one. Unlock dates are always
 * weekdays and the comparison is `<=`, so Saturday and Friday exclude exactly
 * the same set - and a calendar step is the one that stays obviously right if
 * that ever stops being true.
 */
export function openThroughInLondon(now: Date = new Date()): IsoDate {
  const today = todayInLondon(now);
  if (hourInLondon(now) >= PROGRAMME_OPEN_HOUR) return today;
  return fromDayNumber(toDayNumber(today) - 1);
}

/**
 * True when a programme day has come round - today, or already gone.
 *
 * Uses DAILY arithmetic explicitly rather than the default, so it keeps
 * meaning the same thing if the mode ever moves again - which it has once
 * already.
 *
 * Still needed under daily unlock, though the overlap with "is it locked" is
 * now large: an item that has been started or completed never re-locks, so a
 * future day CAN be unlocked and on screen. This is what stops such a day
 * advertising itself with a still frame before it arrives.
 *
 * The same distinction `overdue.ts` draws, one day earlier: `isOverdue` is
 * strictly past, this includes today. Day 0 is the entry gate and is always
 * considered arrived.
 */
export function hasDayArrived(args: {
  dayIndex: number;
  startDate: IsoDate;
  today: IsoDate;
}): boolean {
  if (args.dayIndex <= 0) return true;
  return hasReached(
    unlockDateFor(args.startDate, args.dayIndex, "daily"),
    args.today,
  );
}

/** How many working days the programme runs for. Day 1 is the start Monday. */
export const PROGRAMME_DAYS = 15;

/**
 * The cohort's last day: day 15, which is the Friday of week 3 given that
 * cohorts start on a Monday.
 *
 * Derived rather than assumed. `isMonday` is enforced when a cohort is
 * created, but computing this from working-day arithmetic means the date stays
 * right even if that ever loosens, and it does not need a weekday to be
 * hardcoded anywhere.
 *
 * Deliberately NOT `unlockDateFor(start, 15)`. Under daily unlock those two
 * agree, so the distinction currently costs nothing - but under weekly they
 * did not, and this function must keep meaning "when the programme ends"
 * rather than "when day 15 becomes visible" whichever mode is set.
 */
export function finalDayDate(startDate: IsoDate): IsoDate {
  return addWorkingDays(startDate, PROGRAMME_DAYS - 1);
}
