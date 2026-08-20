/**
 * Per-member RAG status.
 *
 * Recomputed by a nightly job and on attendance / submission events, then
 * denormalised onto programme_cohort_members.rag_status so the admin heatmap
 * doesn't recompute it per cell.
 *
 * The playbook's thresholds:
 *   green - all unlocked items complete and no rejected submission outstanding
 *   amber - 2-4 unlocked items incomplete, OR a rejection awaiting resubmission
 *   red   - >=5 unlocked items incomplete, OR a gate has become impossible
 *
 * SPEC GAP, resolved here: exactly ONE incomplete item falls between the
 * playbook's green (zero) and amber (two to four). It is treated as GREEN -
 * a single outstanding item is normal mid-day progress, and flagging it would
 * make amber meaningless on any day someone hasn't yet watched that morning's
 * video. AMBER_MIN_OUTSTANDING encodes the choice in one place.
 */

import { workingDaysBetween, type IsoDate } from "./working-days";

export type RagStatus = "green" | "amber" | "red";

/** Below this many outstanding items, a member is still green. */
export const AMBER_MIN_OUTSTANDING = 2;

/** At or above this many outstanding items, a member is red. */
export const RED_MIN_OUTSTANDING = 5;

/**
 * Working days a mid-cohort joiner gets before amber can apply. Someone added
 * on day 9 inherits eight days of "overdue" items through no fault of theirs.
 */
export const JOINER_GRACE_WORKING_DAYS = 5;

export type RagInput = {
  /** Unlocked items the member has not completed. */
  outstandingCount: number;
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

  if (input.outstandingCount >= RED_MIN_OUTSTANDING) return "red";

  const wouldBeAmber =
    input.outstandingCount >= AMBER_MIN_OUTSTANDING ||
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
