import { describe, it, expect } from "vitest";
import { decideCompletion } from "@/lib/programme/completion";
import { computeGates, type GateInput } from "@/lib/programme/gates";

const passing: GateInput = {
  contentItemIds: ["a"],
  completedItemIds: new Set(["a"]),
  sessionItemIds: ["s"],
  satisfiedSessionItemIds: new Set(["s"]),
  approvedSignedExamples: 5,
  capstoneCredits: 0,
  bestSummativeQuizScore: 8,
  summativeQuizPassMark: 8,
  hasPostResponse: true,
};

describe("decideCompletion", () => {
  it("completes when all four gates pass for the first time", () => {
    expect(
      decideCompletion({ gates: computeGates(passing), completedAt: null }),
    ).toEqual({ action: "complete" });
  });

  it("does nothing while a gate is outstanding", () => {
    expect(
      decideCompletion({
        gates: computeGates({ ...passing, hasPostResponse: false }),
        completedAt: null,
      }),
    ).toEqual({ action: "none" });
  });

  it("does not re-complete someone already completed", () => {
    // The Slack congratulation fires on this decision, so a second "complete"
    // would announce the same person twice.
    expect(
      decideCompletion({
        gates: computeGates(passing),
        completedAt: "2026-09-18T10:00:00Z",
      }),
    ).toEqual({ action: "already" });
  });

  it("NEVER un-completes when a gate later stops passing", () => {
    // Gates are computed from live data. An admin correcting an attendance
    // mark weeks later must not un-finish someone who has already completed
    // the programme and been announced in the cohort channel.
    expect(
      decideCompletion({
        gates: computeGates({ ...passing, satisfiedSessionItemIds: new Set() }),
        completedAt: "2026-09-18T10:00:00Z",
      }),
    ).toEqual({ action: "already" });
  });
});
