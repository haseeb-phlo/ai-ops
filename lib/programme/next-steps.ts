/**
 * The shortest way back to green.
 *
 * RAG tells a member they are "Behind" and stops. Someone three weeks into a
 * fifteen-day programme with nine items open learns nothing from that they can
 * act on, and the status reads as a judgement rather than as information.
 *
 * Every input needed to do better is already loaded for the RAG calculation
 * itself, so this turns the same numbers around: not how far behind, but which
 * two things would clear it.
 *
 * Two, not nine, and that is the point. `computeRag` allows ONE outstanding
 * item at green (see AMBER_MIN_OUTSTANDING), so the target is almost never
 * "finish everything" - it is a much shorter list than the open count, and
 * showing the short list is what makes the status actionable instead of
 * demoralising.
 */

import { AMBER_MIN_OUTSTANDING, type RagStatus } from "./rag";

export type NextStep = {
  /** Stable key for React, not shown. */
  key: string;
  title: string;
  /** One line on why this particular thing is what is holding the status. */
  why: string;
  /**
   * The days this step names, so a caller listing these next to its own
   * blockers can tell when the two are the same work. Week one's checkpoint
   * asks for the same day-one submission a catch-up step would, and printing
   * both is the page saying one thing twice - the duplication the member track
   * exists to avoid. Empty for a step that names no day, like a resubmission.
   */
  dayIndexes: number[];
};

export type OutstandingItem = {
  dayIndex: number;
  title: string;
};

export type StepsToGreen = {
  /**
   * False when no amount of work clears it. A missed session cannot be
   * un-missed, so promising a route back would be a lie.
   */
  reachable: boolean;
  steps: NextStep[];
};

/** How many open items may remain and still count as green. */
const GREEN_ALLOWANCE = AMBER_MIN_OUTSTANDING - 1;

function describeDays(days: readonly number[]): string {
  if (days.length === 1) return `day ${days[0]}`;
  if (days.length === 2) return `days ${days[0]} and ${days[1]}`;
  return `days ${days[0]} to ${days[days.length - 1]}`;
}

export function stepsToGreen(input: {
  rag: RagStatus;
  /** Unlocked, actionable, not finished. Order does not matter. */
  outstanding: readonly OutstandingItem[];
  hasOutstandingRejection: boolean;
  /** The submission that was sent back, when one was. */
  rejectedTitle: string | null;
  hasImpossibleGate: boolean;
}): StepsToGreen {
  if (input.rag === "green") return { reachable: true, steps: [] };

  // An unreachable gate outranks everything, exactly as it does in computeRag.
  if (input.hasImpossibleGate) return { reachable: false, steps: [] };

  const steps: NextStep[] = [];

  // A rejection blocks green on its own, whatever the item count, so it is
  // always the first thing to say.
  if (input.hasOutstandingRejection) {
    steps.push({
      key: "rejection",
      title: input.rejectedTitle
        ? `Resubmit ${input.rejectedTitle}`
        : "Resubmit the work that was sent back",
      why: "Work waiting on a resubmission holds your status on its own.",
      dayIndexes: [],
    });
  }

  const needed = input.outstanding.length - GREEN_ALLOWANCE;
  if (needed > 0) {
    const ordered = [...input.outstanding].sort(
      (a, b) => a.dayIndex - b.dayIndex || a.title.localeCompare(b.title),
    );
    const take = ordered.slice(0, needed);
    const days = [...new Set(take.map((i) => i.dayIndex))].sort((a, b) => a - b);

    steps.push({
      key: "catch-up",
      // The day is part of the name, not decoration. Every day's exercise is
      // titled just "Task" now that the topic is on the video above it, so
      // "Finish Task" would name nothing at all - and even for a video,
      // "Finish Artifacts" reads better with the day it belongs to attached.
      title:
        take.length === 1
          ? `Finish day ${take[0].dayIndex}: ${take[0].title}`
          : `Finish ${describeDays(days)}`,
      why:
        take.length === 1
          ? "The last thing standing between you and green."
          : `${take.length} items. The rest of what is open can wait for its own week.`,
      dayIndexes: days,
    });
  }

  return { reachable: true, steps };
}
