/**
 * Deriving a new cohort's shape from a start date.
 *
 * The reason this exists rather than a plain form: `session_dates` is JSON
 * keyed by track_item UUID, like
 *
 *   { "906c52ac-...": ["2026-09-02", "2026-09-03"], "4574ca65-...": [...] }
 *
 * Nobody should be looking up three UUIDs by hand, and a form with a JSON
 * textarea would barely improve on writing the INSERT. So the form asks for a
 * start Monday and derives everything: which items are sessions, what dates
 * they fall on, and a join code. The admin then adjusts rather than assembles.
 */

import { addWorkingDays, dayOfWeek, unlockDateFor, type IsoDate } from "./working-days";

export type SessionItemRef = {
  trackItemId: string;
  title: string;
  dayIndex: number;
};

export type DerivedSession = SessionItemRef & {
  /** One date for a single slot, two when the session runs twice. */
  dates: IsoDate[];
};

/** Cohorts start on a Monday: day 1 is the start date and week arithmetic
 *  only reads cleanly if that is a Monday. */
export function isMonday(date: IsoDate): boolean {
  return dayOfWeek(date) === 1;
}

/** The next `count` Mondays on or after `from`, for the start-date picker. */
export function upcomingMondays(from: IsoDate, count = 8): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = from;
  // Walk forward a day at a time; at most six steps to reach the first Monday.
  for (let i = 0; i < 7 && !isMonday(cursor); i++) {
    cursor = addDays(cursor, 1);
  }
  for (let i = 0; i < count; i++) {
    out.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return out;
}

function addDays(iso: IsoDate, days: number): IsoDate {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Default session dates: each session lands on the working day its track item
 * sits on. Dual-slot sessions get that day plus the next working day, which is
 * how Cohort 2 is expected to run given shift patterns.
 */
export function deriveSessionDates(args: {
  startDate: IsoDate;
  sessions: readonly SessionItemRef[];
  /** Track item ids that should run twice. */
  dualSlotItemIds?: ReadonlySet<string>;
}): DerivedSession[] {
  const dual = args.dualSlotItemIds ?? new Set<string>();
  return args.sessions
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((session) => {
      // Always daily arithmetic, whatever the unlock mode is. A session is a
      // real event in a real room: the one on day 3 happens on the Wednesday,
      // not on the Monday its week unlocks.
      const first = unlockDateFor(args.startDate, session.dayIndex, "daily");
      return {
        ...session,
        dates: dual.has(session.trackItemId)
          ? [first, addWorkingDays(first, 1)]
          : [first],
      };
    });
}

/** The shape the cohort row stores: item id -> dates. */
export function toSessionDatesJson(
  sessions: readonly DerivedSession[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const session of sessions) {
    if (session.dates.length > 0) out[session.trackItemId] = session.dates;
  }
  return out;
}

/**
 * A join code that is readable aloud and hard to mistype.
 *
 * No vowels, so it cannot accidentally spell anything; no 0/O or 1/I, which
 * are the characters people get wrong when reading a code off a screen into
 * a Slack message.
 */
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";

export function generateJoinCode(
  cohortName: string,
  random: () => number = Math.random,
): string {
  // Keep a recognisable prefix from the name so a code in a Slack channel is
  // self-evidently for that cohort.
  const prefix =
    cohortName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 6) || "PHLO";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

export type CohortSetupProblem =
  | "name_required"
  | "start_not_a_monday"
  | "session_date_before_start"
  | "duplicate_session_date";

/** Validates what the form collects, before anything is written. */
export function validateCohortSetup(args: {
  name: string;
  startDate: IsoDate;
  sessions: readonly DerivedSession[];
}): CohortSetupProblem[] {
  const problems: CohortSetupProblem[] = [];

  if (args.name.trim() === "") problems.push("name_required");
  if (!isMonday(args.startDate)) problems.push("start_not_a_monday");

  const all = args.sessions.flatMap((s) => s.dates);
  if (all.some((d) => d < args.startDate)) {
    problems.push("session_date_before_start");
  }
  // Two sessions on one day is almost always a mistake, and it silently makes
  // attendance ambiguous for anyone who was at "the session that day".
  if (new Set(all).size !== all.length) {
    problems.push("duplicate_session_date");
  }

  return problems;
}

export const COHORT_SETUP_MESSAGE: Record<CohortSetupProblem, string> = {
  name_required: "Give the cohort a name.",
  start_not_a_monday:
    "Cohorts start on a Monday, so day 1 lines up with the first working day.",
  session_date_before_start: "A session is scheduled before the cohort starts.",
  duplicate_session_date:
    "Two sessions share a date, which makes attendance ambiguous.",
};
