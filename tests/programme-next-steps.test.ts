import { describe, it, expect } from "vitest";
import { stepsToGreen } from "@/lib/programme/next-steps";

const items = (n: number, fromDay = 1) =>
  Array.from({ length: n }, (_, i) => ({
    dayIndex: fromDay + Math.floor(i / 2),
    title: `item ${i + 1}`,
  }));

const base = {
  rag: "amber" as const,
  outstanding: [],
  hasOutstandingRejection: false,
  rejectedTitle: null,
  hasImpossibleGate: false,
};

describe("the shortest route back to green", () => {
  it("has nothing to say to someone already green", () => {
    expect(stepsToGreen({ ...base, rag: "green", outstanding: items(4) })).toEqual(
      { reachable: true, steps: [] },
    );
  });

  it("asks for fewer items than are open, because green tolerates one", () => {
    // Six open, but green allows one loose end - so five, not six.
    const out = stepsToGreen({ ...base, rag: "red", outstanding: items(6) });
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0].why).toContain("5 items");
  });

  it("names the single item when only one stands in the way", () => {
    const out = stepsToGreen({
      ...base,
      outstanding: [
        { dayIndex: 4, title: "Projects - try it yourself" },
        { dayIndex: 5, title: "Week 1 check" },
      ],
    });
    expect(out.steps[0].title).toBe("Finish Projects - try it yourself");
  });

  it("takes the earliest days first", () => {
    const out = stepsToGreen({
      ...base,
      rag: "red",
      outstanding: [
        { dayIndex: 9, title: "i" },
        { dayIndex: 2, title: "i" },
        { dayIndex: 3, title: "i" },
        { dayIndex: 2, title: "j" },
      ],
    });
    // Three needed, earliest first: day 2 twice and day 3.
    expect(out.steps[0].title).toBe("Finish days 2 and 3");
  });

  it("puts a rejection first, and counts it separately from the items", () => {
    const out = stepsToGreen({
      ...base,
      outstanding: items(4),
      hasOutstandingRejection: true,
      rejectedTitle: "Signed example 2",
    });
    expect(out.steps).toHaveLength(2);
    expect(out.steps[0].title).toBe("Resubmit Signed example 2");
    expect(out.steps[1].title).toContain("Finish");
  });

  it("still speaks when a rejection is the only thing wrong", () => {
    // Zero outstanding items, but a rejection alone blocks green.
    const out = stepsToGreen({
      ...base,
      outstanding: [],
      hasOutstandingRejection: true,
      rejectedTitle: "Capstone",
    });
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0].key).toBe("rejection");
  });

  it("falls back to plain wording when the rejected item has no title", () => {
    const out = stepsToGreen({
      ...base,
      hasOutstandingRejection: true,
      rejectedTitle: null,
    });
    expect(out.steps[0].title).toBe("Resubmit the work that was sent back");
  });

  it("promises no route when a gate has become impossible", () => {
    // A missed session cannot be un-missed. Offering steps would be a lie.
    const out = stepsToGreen({
      ...base,
      rag: "red",
      outstanding: items(6),
      hasImpossibleGate: true,
    });
    expect(out).toEqual({ reachable: false, steps: [] });
  });

  it("never asks for more than two things", () => {
    const out = stepsToGreen({
      ...base,
      rag: "red",
      outstanding: items(30),
      hasOutstandingRejection: true,
      rejectedTitle: "x",
    });
    expect(out.steps.length).toBeLessThanOrEqual(2);
  });
});
