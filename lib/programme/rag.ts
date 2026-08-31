/**
 * Per-member RAG status.
 *
 * Recomputed by a nightly job and on attendance / submission events, then
 * denormalised onto programme_cohort_members.rag_status so the admin heatmap
 * doesn't recompute it per cell.
 *
 * The playbook's thresholds:
 *   green - nothing late and no rejected submission outstanding
 *   amber - 2-4 items late, OR a rejection awaiting resubmission
 *   red   - >=5 items late, OR a gate has become impossible
 *
 * LATE, not merely open. This mattered acutely while the app unlocked a week
 * at a time - counting everything available made the first morning of a
 * cohort read red for everybody - and still matters under daily unlock,
 * because work already started never re-locks. `overdue.ts` draws the
 * distinction and owns the reasoning - this file only counts.
 *
 * SPEC GAP, resolved here: exactly ONE late item falls between the playbook's
 * green (zero) and amber (two to four). It is treated as GREEN - a single
 * item left over from yesterday is normal progress, and flagging it would make
 * amber meaningless on any day someone hasn't yet watched one video.
 * AMBER_MIN_OUTSTANDING encodes the choice in one place.
 */

import { workingDaysBetween, type IsoDate } from "./working-days";

export type RagStatus = "green" | "amber" | "red";

/** Below this many LATE items, a member is still green. */
export const AMBER_MIN_OUTSTANDING = 2;

/** At or above this many LATE items, a member is red. */
export const RED_MIN_OUTSTANDING = 5;

/**
 * Working days a mid-cohort joiner gets before amber can apply. Someone added
 * on day 9 inherits eight days of "overdue" items through no fault of theirs.
 */
export const JOINER_GRACE_WORKING_DAYS = 5;

export type RagInput = {
  /**
   * Unlocked, actionable items the member has not completed whose own day has
   * already passed. NOT the count of everything open - see overdue.ts.
   */
  overdueCount: number;
  /** A submission was rejected and has not been resubmitted. */
  hasOutstandingRejection: boolean;
  /**
   * A gate can no longer be reached in time - e.g. every session slot has
   * passed with no attendance and no excusal.
   */
  hasImpossibleGate: boolean;
  /** When this member joined, for the grace calculation. */
  joinedOn: IsoDate;
  /** The cohort's start date. */
  cohortStartDate: IsoDate;
  today: IsoDate;
};

/**
 * True when the member joined after the cohort began and is still inside their
 * grace window.
 */
export function isWithinJoinerGrace(args: {
  joinedOn: IsoDate;
  cohortStartDate: IsoDate;
  today: IsoDate;
}): boolean {
  const joinedLate = workingDaysBetween(args.cohortStartDate, args.joinedOn) > 0;
  if (!joinedLate) return false;
  return (
    workingDaysBetween(args.joinedOn, args.today) < JOINER_GRACE_WORKING_DAYS
  );
}

export function computeRag(input: RagInput): RagStatus {
  // An unreachable gate is terminal: no amount of catching up fixes a session
  // that has already happened. This outranks the grace window.
  if (input.hasImpossibleGate) return "red";

  if (input.overdueCount >= RED_MIN_OUTSTANDING) return "red";

  const wouldBeAmber =
    input.overdueCount >= AMBER_MIN_OUTSTANDING ||
    input.hasOutstandingRejection;

  if (!wouldBeAmber) return "green";

  // A late joiner is not behind yet - they've had less time.
  if (
    isWithinJoinerGrace({
      joinedOn: input.joinedOn,
      cohortStartDate: input.cohortStartDate,
      today: input.today,
    })
  ) {
    return "green";
  }

  return "amber";
}
