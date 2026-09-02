/**
 * The shareable link to one programme day.
 *
 * The programme is a drip and Slack is where the cohort actually is, so a day
 * only really happens when somebody posts a link to it. Two places need to
 * agree about what that link looks like - the admin panel that copies it and
 * the track page that reads it back - so the shape lives here rather than
 * being written twice.
 *
 * COHORT-AGNOSTIC ON PURPOSE. No cohort id in the path: a member follows it to
 * their OWN cohort's day N, which is what a link pasted into a channel has to
 * do. Pinning a cohort would send anyone in a different one to a track they
 * cannot see.
 */
import { PROGRAMME_DAYS } from "./working-days";

/** Path and query for a day, relative to the app origin. */
export function dayLinkPath(dayIndex: number): string {
  return `/learn/track?day=${dayIndex}`;
}

/**
 * Reads a `?day=` value into a day this cohort actually has, or null.
 *
 * Null means "no day was asked for", which the track page treats as today -
 * so a mistyped or stale link lands somebody on their current day rather than
 * on an empty card.
 *
 * DIGITS ONLY, tested on the string before `Number` sees it. `Number` is far
 * too generous to be the gate: it reads "3.5" as 3.5, " 3 " as 3, "+3" as 3
 * and - the one that actually got through - "1e1" as 10, so `?day=1e1` opened
 * day ten. None of those is a day anybody meant to link to, and a parser that
 * guesses at them will eventually guess wrong in a channel of 138 people.
 *
 * `days` is passed in rather than assumed to be 1..15 because a cohort's track
 * is whatever its items say it is, and a link to a day the cohort does not
 * have is as wrong as a link to day 99.
 */
const PLAIN_DIGITS = /^\d+$/;

export function parseDayParam(
  raw: string | undefined,
  days: readonly number[],
): number | null {
  if (raw === undefined || !PLAIN_DIGITS.test(raw)) return null;
  const dayIndex = Number(raw);
  // Day 0 is the entry gate, which renders as its own card rather than as a
  // row in the timeline, so there is nothing for a link to select.
  if (dayIndex < 1 || dayIndex > PROGRAMME_DAYS) return null;
  return days.includes(dayIndex) ? dayIndex : null;
}
