import { describe, it, expect } from "vitest";
import { resolveItemStates, outstandingItems } from "@/lib/programme/unlock";
import { countOverdue, overdueOnly } from "@/lib/programme/overdue";
import { computeRag } from "@/lib/programme/rag";
import { stepsToGreen } from "@/lib/programme/next-steps";
import { isAwaitingContent } from "@/lib/programme/content-readiness";

/**
 * The day-0 check-in, told as the incident it caused.
 *
 * Reported from Cohort 1A on 2026-09-07: the check-in "is still coming up as
 * needing to be completed, however [members] are unable to see it to
 * complete it". Every one of the twenty-five members across the two live
 * cohorts who had answered it saw the same thing, because none of them had a
 * progress row for it - the check-in writes to `ai_score_responses` and
 * nothing else.
 *
 * The four modules below are the whole path from "which items are open" to
 * the sentence the member actually read, and no single one of them was wrong.
 * That is why this test spans all four rather than living in any of their
 * files: the bug only exists in the composition, so only the composition can
 * hold it down.
 *
 * The fixture is the real track as that member had it - day 6 of the cohort,
 * everything up to and including day 6 done except the day-3 live session,
 * which they attended but which records attendance in its own table too.
 */

const START = "2026-08-31"; // Monday
const TODAY = "2026-09-07"; // the Monday after - programme day 6

const items = [
  { id: "gate", type: "questionnaire_baseline", day_index: 0, title: "Your AI Score - 3-minute check-in", learn_video_id: null },
  { id: "d1v", type: "video", day_index: 1, title: "What is AI and how does it work?", learn_video_id: "v1" },
  { id: "d1u", type: "use_example", day_index: 1, title: "Task", learn_video_id: null },
  { id: "d3s", type: "session", day_index: 3, title: "Live session 1", learn_video_id: null },
  { id: "d6v", type: "video", day_index: 6, title: "Skills", learn_video_id: "v6" },
  { id: "d6u", type: "use_example", day_index: 6, title: "Task", learn_video_id: null },
  { id: "d7v", type: "video", day_index: 7, title: "Research, Memory & files out", learn_video_id: null },
];

/** Everything the member had actually ticked off. Note: no row for "gate". */
const progress = new Map<string, "complete">([
  ["d1v", "complete"],
  ["d1u", "complete"],
  ["d6v", "complete"],
  ["d6u", "complete"],
]);

function statusFor(answeredBaseline: boolean) {
  const resolved = resolveItemStates({
    items,
    startDate: START,
    today: TODAY,
    hasBaseline: true,
    answeredCheckIns: { baseline: answeredBaseline },
    progressByItemId: progress,
    unlockMode: "daily",
  });

  // Exactly what track-data.ts does with the result.
  const open = outstandingItems(resolved).filter(
    (r) => !isAwaitingContent(r.item),
  );
  const dated = open.map((r) => ({
    dayIndex: r.item.day_index,
    title: r.item.title,
  }));
  const overdueCount = countOverdue(dated, { startDate: START, today: TODAY });
  const rag = computeRag({
    overdueCount,
    hasOutstandingRejection: false,
    hasImpossibleGate: false,
    joinedOn: START,
    cohortStartDate: START,
    today: TODAY,
  });

  return {
    openIds: open.map((r) => r.item.id),
    overdueCount,
    rag,
    steps: stepsToGreen({
      rag,
      outstanding: overdueOnly(dated, { startDate: START, today: TODAY }),
      hasOutstandingRejection: false,
      rejectedTitle: null,
      hasImpossibleGate: false,
    }),
  };
}

describe("an answered check-in is not outstanding work", () => {
  it("drops out of the open count once it has been answered", () => {
    // The day-3 session is the only thing genuinely left. It is visible on
    // the timeline; the check-in never was.
    expect(statusFor(true).openIds).toEqual(["d3s"]);
  });

  it("stops being permanently overdue", () => {
    // Day 0's unlock date IS the cohort start date, so from the second
    // morning of the cohort onwards it was late every single day.
    expect(statusFor(true).overdueCount).toBe(1);
    expect(statusFor(true).rag).toBe("green");
  });

  it("leaves nothing for stepsToGreen to name", () => {
    const { steps } = statusFor(true);
    expect(steps.reachable).toBe(true);
    expect(steps.steps).toEqual([]);
  });

  it("reproduces the reported state when the answer is not read", () => {
    // The sentence on the member's dashboard, and the two numbers either side
    // of it. Everything here is correct arithmetic over one wrong input.
    const before = statusFor(false);
    expect(before.openIds).toEqual(["gate", "d3s"]);
    expect(before.overdueCount).toBe(2);
    expect(before.rag).toBe("amber");
    expect(before.steps.steps[0].title).toBe(
      "Finish day 0: Your AI Score - 3-minute check-in",
    );
  });
});
