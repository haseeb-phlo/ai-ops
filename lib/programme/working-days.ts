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
 * Holds: a day that must NOT open at `PROGRAMME_OPEN_HOUR`, kept shut until a
 * stated instant and then opening by itself.
 *
 * This is the small lever, and the reason it exists rather than a change to
 * `PROGRAMME_OPEN_HOUR` is that the constant is global and permanent. Moving
 * it to hold one morning would move every future morning for every cohort,
 * and the two numbers it is bound to - `MEMBER_REMINDER_HOUR` and the label
 * above - would have to move with it and then move back.
 *
 * The key is a DAY INDEX and the value is an instant, so a hold expires on
 * the clock rather than needing to be removed. That matters more than it
 * looks: the alternative is a boolean somebody has to come back and unset,
 * and the failure mode of that is a day still shut on Friday because nobody
 * did. An entry left here after its instant has passed is inert.
 *
 * THREE THINGS IT DOES NOT DO, all deliberate:
 *
 *   - it does not re-lock work already started or completed. That invariant
 *     lives in `resolveItemStates` and sits above this check, so a member who
 *     opened the day before the hold went in keeps it. A member who was
 *     reading it without recording progress does lose it until the instant
 *     passes, which is the honest cost of holding a day that is already open;
 *   - it is not scoped to a cohort. Before the hold's instant the day is shut
 *     for everyone, which is right when the reason is that the day's content
 *     is not ready, and wrong if a hold is ever wanted for one cohort only.
 *     Add a cohort id to the key if that day comes;
 *   - it does not correct the copy. `PROGRAMME_OPEN_LABEL` is global by
 *     design - one spelling in one place - so a held day still reads "opens
 *     7am" on the timeline and on the day card while it is shut. Between the
 *     day's own opening and the hold's instant that line is wrong, and a
 *     member reading it at 07:30 is told the day opened half an hour ago.
 *     Making it right means a per-day label, which is a change to that
 *     constant's design rather than a use of this one, and not a thing to
 *     attempt on the morning a hold is needed. Day 9 shipped with this, so
 *     did day 10, and days 11-15 ship with it five mornings running.
 *
 * AN EMPTY TABLE IS THE NORMAL STATE AND THE TABLE IS NOT EMPTY. The lever
 * was first used a day at a time, twice, both times because the day's video
 * was not ready when the day opened at 07:00, and the two uses ended
 * differently:
 *
 *   - day 9, held to 09:00 on 2026-09-10. The video was uploaded at 07:39 and
 *     the entry came out about an hour before its instant, so the hold did
 *     its job: the day was shut for exactly as long as it had nothing to
 *     show;
 *   - day 10, held to 09:00 on 2026-09-11. The video did NOT arrive in time.
 *     The hold expired on its own at 09:00 and the recording landed at 10:34,
 *     so day 10 was open with no video for about 95 minutes and anyone who
 *     opened it in that window saw "coming soon". The entry was spent, not
 *     released.
 *
 * Day 9 is the shape to copy - a hold goes in for a reason that is visible
 * and comes out when the reason goes. Day 10 is the honest record of what the
 * instant is FOR: it is the backstop for the times nobody comes back, and a
 * backstop opening a day that is still not ready is the cost of not needing
 * anybody to come back.
 *
 * THE THIRD USE IS THE FIVE ENTRIES BELOW: days 11-15, every morning the
 * programme has left, each held to 09:00 on its own date. Two mornings in a
 * row had wanted the same hold for the same reason, each decided at 07:00 by
 * whoever was awake to notice, so the rest of the run goes in up front. That
 * is the lesson day 10 left - set the instant to when the day is actually
 * ready to be met, rather than to the start of the working day and then a
 * scramble - applied to the whole remainder rather than to one more morning.
 *
 * It stretches "one-off" past what the paragraphs above were written for, in
 * two ways worth naming rather than discovering:
 *
 *   - the copy is wrong on five consecutive mornings instead of one. See the
 *     third bullet above: from 07:00 to 09:00 each of these days reads "opens
 *     7am" while it is shut, and that is now the state of the app every
 *     morning until the programme ends;
 *   - day 11's entry landed either side of its own 07:00 open, so for that
 *     day this was not a day kept shut but a day taken back. The invariant
 *     above is what makes that survivable: anybody who had started or
 *     completed something on day 11 kept it, and only somebody reading it
 *     without recording progress lost it, for two hours.
 *
 * The entries expire on their own, so nothing has to be unset. Taking a spent
 * entry out rather than leaving it to expire is still deliberate. A spent
 * entry is inert, so leaving it costs nothing mechanically, but an entry
 * sitting here reads as a hold somebody forgot - and the next person to need
 * this would have to work out whether that day is still shut before adding
 * theirs. After 2026-09-18 09:00 the whole table is spent: empty it, and put
 * the suite's `DAY_HOLDS.size` assertion back to 0.
 */
export const DAY_HOLDS: ReadonlyMap<number, string> = new Map([
  [11, "2026-09-14T09:00:00+01:00"],
  [12, "2026-09-15T09:00:00+01:00"],
  [13, "2026-09-16T09:00:00+01:00"],
  [14, "2026-09-17T09:00:00+01:00"],
  [15, "2026-09-18T09:00:00+01:00"],
]);

/**
 * The day indexes currently held shut, at instant `now`.
 *
 * Pass the result to `resolveItemStates`, the way `openThroughInLondon` is
 * passed as `today`: the resolver stays a pure function of its arguments and
 * the clock is read once, by the caller.
 *
 * `holds` is injectable for the same reason `now` is. The tests then pin the
 * MECHANISM rather than whatever is in the live table, so adding or removing
 * a hold is a one-line change that breaks nothing - which is the property you
 * want on the morning you are using it.
 */
export function heldDayIndexes(
  now: Date = new Date(),
  holds: ReadonlyMap<number, string> = DAY_HOLDS,
): ReadonlySet<number> {
  const held = new Set<number>();
  for (const [dayIndex, until] of holds) {
    if (now.getTime() < Date.parse(until)) held.add(dayIndex);
  }
  return held;
}

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

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * How a stored date is written for a person to read.
 *
 *   "short"     - "2 Sep 2026". The default, and the safe one for a table.
 *   "long"      - "2 September 2026", for a page header or a sentence.
 *   "day-month" - "2 Sep", where the year is already established by context
 *                 and repeating it is noise. The roster grid's slot buttons
 *                 are the case: a cohort spans three weeks, so no two slots
 *                 there can differ by a year.
 */
export type DateStyle = "short" | "long" | "day-month";

/**
 * An ISO date written the way it is read here: "2026-09-02" -> "2 Sep 2026".
 *
 * STRING ARITHMETIC, not `Date` + `toLocaleDateString`, for the reason at the
 * top of this file. These are calendar dates with no time component, and
 * parsing one into a `Date` to format it re-introduces the exact timezone bug
 * the rest of the module exists to avoid: `new Date("2026-09-02")` is midnight
 * UTC, which formats as the 1st of September for any viewer behind it. That is
 * not hypothetical for this app - the roster grid is a client component, so it
 * formats in the *viewer's* timezone rather than the server's, and a session
 * date that reads a day early to somebody working from Toronto is a person
 * turning up on the wrong day.
 *
 * It also means the output does not depend on a runtime locale. `en-GB` has to
 * be passed to `toLocaleDateString` every single time or Node's default wins
 * and the date silently comes out American; that is the failure this replaces,
 * and it cannot recur through a function with no locale to forget.
 *
 * THROWS on a malformed date, matching `toDayNumber` rather than passing the
 * raw string through. One convention per module for bad input, and a throw in
 * a Server Component surfaces as an error page, where an ISO date sitting in a
 * column of British ones just looks like a styling slip nobody chases.
 */
export function formatIsoDate(iso: IsoDate, style: DateStyle = "short"): string {
  if (!ISO_DATE_RE.test(iso)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${iso}"`);
  }
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  // The regex checks shape, not range: "2026-13-01" is well formed and has no
  // thirteenth month. Without this, that renders as "1 undefined 2026".
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Expected a month between 01 and 12, got "${iso}"`);
  }
  const name = (style === "long" ? MONTHS_LONG : MONTHS_SHORT)[monthIndex];
  // Number() strips the leading zero: "02" -> 2. British dates do not pad.
  const dayAndMonth = `${Number(day)} ${name}`;
  return style === "day-month" ? dayAndMonth : `${dayAndMonth} ${year}`;
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
