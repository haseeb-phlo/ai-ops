import { describe, it, expect } from "vitest";
import { countOverdue, isOverdue, overdueOnly } from "@/lib/programme/overdue";
import { computeRag } from "@/lib/programme/rag";

const START = "2026-08-31"; // a Monday, and Cohort 1A's real start date

describe("isOverdue", () => {
  it("is false on the day an item belongs to", () => {
    expect(isOverdue({ dayIndex: 1, startDate: START, today: START })).toBe(false);
  });

  it("is false for a day still in the future", () => {
    expect(isOverdue({ dayIndex: 5, startDate: START, today: START })).toBe(false);
  });

  it("is true once the day has passed", () => {
    expect(isOverdue({ dayIndex: 1, startDate: START, today: "2026-09-01" })).toBe(
      true,
    );
  });

  it("counts working days, so Monday's day 5 is Friday not Saturday", () => {
    // Day 5 is the Friday of week one. It is not late on the Friday...
    expect(isOverdue({ dayIndex: 5, startDate: START, today: "2026-09-04" })).toBe(
      false,
    );
    // ...and is late by the following Monday.
    expect(isOverdue({ dayIndex: 5, startDate: START, today: "2026-09-07" })).toBe(
      true,
    );
  });

  it("treats the day-0 check-in as due from the start date", () => {
    expect(isOverdue({ dayIndex: 0, startDate: START, today: START })).toBe(false);
    expect(isOverdue({ dayIndex: 0, startDate: START, today: "2026-09-01" })).toBe(
      true,
    );
  });
});

describe("the day-one red problem", () => {
  // Week one of the real track, as it opens under weekly unlock: four video
  // days with a use example each, a session, two submission slots and a quiz.
  // Thirteen items, all available on the first morning.
  const weekOne = [
    { dayIndex: 1 },
    { dayIndex: 1 },
    { dayIndex: 1 },
    { dayIndex: 2 },
    { dayIndex: 2 },
    { dayIndex: 3 },
    { dayIndex: 3 },
    { dayIndex: 3 },
    { dayIndex: 3 },
    { dayIndex: 4 },
    { dayIndex: 4 },
    { dayIndex: 5 },
    { dayIndex: 5 },
  ];

  it("does not call anybody behind on the first morning", () => {
    // The bug: counting everything OPEN gave 13, and red starts at 5. A member
    // who did the mandatory check-in was told immediately that they were
    // "Behind" - for work that had existed for about a minute.
    expect(weekOne.length).toBeGreaterThanOrEqual(5);
    expect(countOverdue(weekOne, { startDate: START, today: START })).toBe(0);

    expect(
      computeRag({
        overdueCount: countOverdue(weekOne, { startDate: START, today: START }),
        hasOutstandingRejection: false,
        hasImpossibleGate: false,
        joinedOn: START,
        cohortStartDate: START,
        today: START,
      }),
    ).toBe("green");
  });

  it("still notices somebody who has done nothing all week", () => {
    const overdue = countOverdue(weekOne, {
      startDate: START,
      today: "2026-09-07",
    });
    expect(overdue).toBe(13);
    expect(
      computeRag({
        overdueCount: overdue,
        hasOutstandingRejection: false,
        hasImpossibleGate: false,
        joinedOn: START,
        cohortStartDate: START,
        today: "2026-09-07",
      }),
    ).toBe("red");
  });

  it("turns amber, not red, the day after a slow start", () => {
    // Tuesday, with Monday's three items untouched.
    const overdue = countOverdue(weekOne, {
      startDate: START,
      today: "2026-09-01",
    });
    expect(overdue).toBe(3);
    expect(
      computeRag({
        overdueCount: overdue,
        hasOutstandingRejection: false,
        hasImpossibleGate: false,
        joinedOn: START,
        cohortStartDate: START,
        today: "2026-09-01",
      }),
    ).toBe("amber");
  });
});

describe("overdueOnly", () => {
  it("keeps the items themselves, so next steps names the right ones", () => {
    const items = [
      { dayIndex: 1, title: "Day one video" },
      { dayIndex: 4, title: "Day four video" },
    ];
    expect(
      overdueOnly(items, { startDate: START, today: "2026-09-01" }),
    ).toEqual([{ dayIndex: 1, title: "Day one video" }]);
  });
});
