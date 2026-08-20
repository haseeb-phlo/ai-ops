/**
 * Session attendance, and what it means for gate G2.
 *
 * Three rules that are easy to get subtly wrong:
 *
 *   1. A session can run in TWO slots (people can't all leave the dispensary
 *      at once). Attending EITHER satisfies the item - the slot is recorded
 *      for the organiser's benefit, not as a second hurdle.
 *   2. "Excused" alone does NOT satisfy G2. Excused plus `make_up` does -
 *      that's someone who attended the equivalent session in another cohort.
 *      Without the distinction, being excused would be a free pass and G2
 *      would mean nothing.
 *   3. A session only becomes IMPOSSIBLE once its last slot is in the past.
 *      Judging it on the first slot would write people off who are booked
 *      into the second.
 */

import { hasReached, type IsoDate } from "./working-days";

export const ATTENDANCE_STATUSES = ["attended", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Roster cells cycle through these on tap; null clears the mark. */
export const ATTENDANCE_CYCLE: readonly (AttendanceStatus | null)[] = [
  null,
  "attended",
  "absent",
  "excused",
];

export function nextAttendanceStatus(
  current: AttendanceStatus | null,
): AttendanceStatus | null {
  const index = ATTENDANCE_CYCLE.indexOf(current);
  return ATTENDANCE_CYCLE[(index + 1) % ATTENDANCE_CYCLE.length];
}

export type AttendanceRecord = {
  trackItemId: string;
  status: AttendanceStatus;
  /** meta_json.make_up - attended the equivalent session in another cohort. */
  makeUp?: boolean;
};

/** Does this record satisfy the session for G2 purposes? */
export function satisfiesSession(record: AttendanceRecord): boolean {
  if (record.status === "attended") return true;
  return record.status === "excused" && record.makeUp === true;
}

/** Session item ids this member has satisfied. */
export function satisfiedSessionIds(
  records: readonly AttendanceRecord[],
): Set<string> {
  const out = new Set<string>();
  for (const record of records) {
    if (satisfiesSession(record)) out.add(record.trackItemId);
  }
  return out;
}

/**
 * True once every slot for a session has passed. A session on today's date is
 * NOT past - people attend during the day.
 */
export function sessionHasPassed(
  slotDates: readonly string[],
  today: IsoDate,
  fallbackDate: IsoDate,
): boolean {
  const dates = slotDates.length > 0 ? [...slotDates].sort() : [fallbackDate];
  const last = dates[dates.length - 1];
  return hasReached(last, today) && last !== today;
}

/**
 * Is G2 now unreachable? True when at least one session has passed unsatisfied
 * - no attendance, and no excusal with a make-up.
 */
export function isG2Impossible(args: {
  sessions: readonly { trackItemId: string; slotDates: readonly string[]; fallbackDate: IsoDate }[];
  satisfied: ReadonlySet<string>;
  today: IsoDate;
}): boolean {
  return args.sessions.some(
    (session) =>
      !args.satisfied.has(session.trackItemId) &&
      sessionHasPassed(session.slotDates, args.today, session.fallbackDate),
  );
}

/** Attendance totals for the admin summary. */
export function summariseAttendance(
  records: readonly AttendanceRecord[],
  memberCount: number,
): {
  attended: number;
  absent: number;
  excused: number;
  unmarked: number;
  satisfied: number;
} {
  let attended = 0;
  let absent = 0;
  let excused = 0;
  let satisfied = 0;
  for (const record of records) {
    if (record.status === "attended") attended++;
    else if (record.status === "absent") absent++;
    else if (record.status === "excused") excused++;
    if (satisfiesSession(record)) satisfied++;
  }
  return {
    attended,
    absent,
    excused,
    unmarked: Math.max(0, memberCount - records.length),
    satisfied,
  };
}
