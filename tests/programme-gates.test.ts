import { describe, it, expect } from "vitest";
import {
  allGatesPassed,
  computeGates,
  g3Credits,
  GATE_IDS,
  type GateInput,
} from "@/lib/programme/gates";

const passing: GateInput = {
  contentItemIds: ["a", "b", "c"],
  completedItemIds: new Set(["a", "b", "c"]),
  sessionItemIds: ["s1", "s2", "s3"],
  satisfiedSessionItemIds: new Set(["s1", "s2", "s3"]),
  approvedSignedExamples: 5,
  capstoneCredits: 0,
  bestSummativeQuizScore: 8,
  summativeQuizPassMark: 8,
  hasPostResponse: true,
};

describe("G1 - content complete", () => {
  it("passes when every video and worked example is done", () => {
    expect(computeGates(passing).g1).toEqual({
      passed: true,
      current: 3,
      target: 3,
    });
  });

  it("fails one item short", () => {
    const g = computeGates({
      ...passing,
      completedItemIds: new Set(["a", "b"]),
    });
    expect(g.g1.passed).toBe(false);
    expect(g.g1.current).toBe(2);
  });

  it("does not pass vacuously when the track has no content items", () => {
    // An empty track must not hand out a gate for free.
    const g = computeGates({ ...passing, contentItemIds: [] });
    expect(g.g1.passed).toBe(false);
  });

  it("ignores completions for items not on the track", () => {
    const g = computeGates({
      ...passing,
      completedItemIds: new Set(["a", "b", "c", "stray"]),
    });
    expect(g.g1.current).toBe(3);
  });
});

describe("G2 - sessions attended", () => {
  it("passes when all three sessions are satisfied", () => {
    expect(computeGates(passing).g2.passed).toBe(true);
  });

  it("fails when one session is missed", () => {
    const g = computeGates({
      ...passing,
      satisfiedSessionItemIds: new Set(["s1", "s2"]),
    });
    expect(g.g2.passed).toBe(false);
    expect(g.g2.current).toBe(2);
  });

  it("counts an excused-with-make-up session as satisfied", () => {
    // The caller folds make_up into satisfiedSessionItemIds; the gate itself
    // only cares that the session is accounted for.
    expect(
      computeGates({
        ...passing,
        satisfiedSessionItemIds: new Set(["s1", "s2", "s3"]),
      }).g2.passed,
    ).toBe(true);
  });

  it("does not pass vacuously with no sessions on the track", () => {
    expect(computeGates({ ...passing, sessionItemIds: [] }).g2.passed).toBe(
      false,
    );
  });
});

describe("G3 - approved examples, with capstone substitution", () => {
  it("passes on five approved examples alone", () => {
    expect(computeGates(passing).g3.passed).toBe(true);
  });

  it("fails on four examples with no capstone", () => {
    expect(
      computeGates({ ...passing, approvedSignedExamples: 4 }).g3.passed,
    ).toBe(false);
  });

  it("passes on three examples plus a 2-credit capstone - the boundary", () => {
    // Substitution, not addition: 3 + 2 = 5.
    expect(
      computeGates({
        ...passing,
        approvedSignedExamples: 3,
        capstoneCredits: 2,
      }).g3.passed,
    ).toBe(true);
  });

  it("fails on two examples plus a capstone - one short", () => {
    expect(
      computeGates({
        ...passing,
        approvedSignedExamples: 2,
        capstoneCredits: 2,
      }).g3.passed,
    ).toBe(false);
  });

  it("clamps an over-generous capstone to two credits", () => {
    expect(g3Credits(2, 99)).toBe(4);
    expect(
      computeGates({
        ...passing,
        approvedSignedExamples: 2,
        capstoneCredits: 99,
      }).g3.passed,
    ).toBe(false);
  });

  it("ignores a negative capstone credit", () => {
    expect(g3Credits(5, -3)).toBe(5);
  });

  it("caps the displayed progress at the target", () => {
    // "7/5" would look broken on the chip.
    expect(
      computeGates({ ...passing, approvedSignedExamples: 7 }).g3.current,
    ).toBe(5);
  });
});

describe("G4 - quiz and post check-in", () => {
  it("passes when the quiz is passed and the post response exists", () => {
    expect(computeGates(passing).g4.passed).toBe(true);
  });

  it("fails on the quiz alone", () => {
    expect(
      computeGates({ ...passing, hasPostResponse: false }).g4.passed,
    ).toBe(false);
  });

  it("fails on the post response alone", () => {
    expect(
      computeGates({ ...passing, bestSummativeQuizScore: 5 }).g4.passed,
    ).toBe(false);
  });

  it("fails when the quiz was never attempted", () => {
    expect(
      computeGates({ ...passing, bestSummativeQuizScore: null }).g4.passed,
    ).toBe(false);
  });

  it("treats exactly the pass mark as a pass", () => {
    expect(
      computeGates({
        ...passing,
        bestSummativeQuizScore: 8,
        summativeQuizPassMark: 8,
      }).g4.passed,
    ).toBe(true);
  });

  it("reads the pass mark from config rather than assuming 8", () => {
    // A retuned quiz must not silently keep the old threshold.
    expect(
      computeGates({
        ...passing,
        bestSummativeQuizScore: 4,
        summativeQuizPassMark: 4,
      }).g4.passed,
    ).toBe(true);
    expect(
      computeGates({
        ...passing,
        bestSummativeQuizScore: 7,
        summativeQuizPassMark: 9,
      }).g4.passed,
    ).toBe(false);
  });
});

describe("allGatesPassed", () => {
  it("is true only when every gate passes", () => {
    expect(allGatesPassed(computeGates(passing))).toBe(true);
  });

  it("is false when any single gate fails", () => {
    for (const failing of [
      { completedItemIds: new Set(["a"]) },
      { satisfiedSessionItemIds: new Set(["s1"]) },
      { approvedSignedExamples: 0 },
      { hasPostResponse: false },
    ]) {
      expect(
        allGatesPassed(computeGates({ ...passing, ...failing } as GateInput)),
      ).toBe(false);
    }
  });

  it("covers all four gate ids", () => {
    expect(Object.keys(computeGates(passing)).sort()).toEqual([...GATE_IDS]);
  });
});
