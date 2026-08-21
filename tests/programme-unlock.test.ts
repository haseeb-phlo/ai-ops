import { describe, it, expect } from "vitest";
import {
  outstandingItems,
  resolveItemStates,
  unlockedItems,
  type ItemState,
} from "@/lib/programme/unlock";

const START = "2026-08-31"; // Monday

const items = [
  { id: "gate", type: "questionnaire_baseline", day_index: 0 },
  { id: "d1v", type: "video", day_index: 1 },
  { id: "d1u", type: "use_example", day_index: 1 },
  { id: "d5q", type: "quiz", day_index: 5 },
  { id: "d8s", type: "session", day_index: 8 },
  { id: "d15v", type: "video", day_index: 15 },
  { id: "d15q", type: "quiz", day_index: 15 },
  { id: "d15p", type: "questionnaire_post", day_index: 15 },
];

const stateOf = (
  resolved: ReturnType<typeof resolveItemStates>,
  id: string,
): ItemState => resolved.find((r) => r.item.id === id)!.state;

// The cases below pin DAILY behaviour explicitly. Weekly is the default in
// production; see the weekly block at the end.
describe("the baseline gate", () => {
  it("is available on day one even with no baseline response", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: false,
      unlockMode: "daily",
    });
    expect(stateOf(r, "gate")).toBe("available");
  });

  it("blocks everything else until the baseline is submitted", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: false,
      unlockMode: "daily",
    });
    expect(stateOf(r, "d1v")).toBe("locked");
    expect(stateOf(r, "d1u")).toBe("locked");
  });

  it("releases day-appropriate items once the baseline exists", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(stateOf(r, "d1v")).toBe("available");
    expect(stateOf(r, "d1u")).toBe("available");
    // Later days stay locked by date.
    expect(stateOf(r, "d8s")).toBe("locked");
  });

  it("still blocks even late in the programme when no baseline was done", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-18", // day 15
      hasBaseline: false,
      unlockMode: "daily",
    });
    expect(stateOf(r, "d1v")).toBe("locked");
    expect(stateOf(r, "d8s")).toBe("locked");
  });
});

describe("quiz and post check-in are gate-exempt", () => {
  it("unlock on their date even with no baseline response", () => {
    // Someone who skipped the baseline can still be measured at the end.
    const r = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-18", // day 15
      hasBaseline: false,
      unlockMode: "daily",
    });
    expect(stateOf(r, "d15q")).toBe("available");
    expect(stateOf(r, "d15p")).toBe("available");
    expect(stateOf(r, "d5q")).toBe("available"); // day 5 already passed
  });

  it("stay locked before their date", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(stateOf(r, "d5q")).toBe("locked");
    expect(stateOf(r, "d15q")).toBe("locked");
  });
});

describe("unlock dates follow working days", () => {
  it("opens day 5 on the Friday, not the Saturday", () => {
    const friday = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-04",
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(stateOf(friday, "d5q")).toBe("available");

    const thursday = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-03",
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(stateOf(thursday, "d5q")).toBe("locked");
  });

  it("reports the unlock date on locked items so the UI can label them", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(r.find((x) => x.item.id === "d15v")!.unlockDate).toBe("2026-09-18");
  });

  it("counts a weekend visit as the preceding Friday's unlocks, not more", () => {
    const saturday = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-05",
      hasBaseline: true,
      unlockMode: "daily",
    });
    expect(stateOf(saturday, "d5q")).toBe("available");
    expect(stateOf(saturday, "d8s")).toBe("locked");
  });
});

describe("items never re-lock", () => {
  it("keeps a completed item complete even if the start date moves later", () => {
    const r = resolveItemStates({
      items,
      startDate: "2026-12-07", // cohort rescheduled far into the future
      today: START,
      hasBaseline: true,
      unlockMode: "daily",
      progressByItemId: new Map([["d15v", "complete"]]),
    });
    expect(stateOf(r, "d15v")).toBe("complete");
  });

  it("keeps a started item started even when the baseline gate is not met", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: false,
      unlockMode: "daily",
      progressByItemId: new Map([["d1v", "started"]]),
    });
    expect(stateOf(r, "d1v")).toBe("started");
  });

  it("does not resurrect an item recorded as locked", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: false,
      unlockMode: "daily",
      progressByItemId: new Map([["d1v", "locked"]]),
    });
    expect(stateOf(r, "d1v")).toBe("locked");
  });
});

describe("unlockedItems / outstandingItems", () => {
  const resolved = resolveItemStates({
    items,
    startDate: START,
    today: START,
    hasBaseline: true,
    unlockMode: "daily",
    progressByItemId: new Map([["d1v", "complete"]]),
  });

  it("counts everything not locked as unlocked", () => {
    const ids = unlockedItems(resolved).map((r) => r.item.id).sort();
    expect(ids).toEqual(["d1u", "d1v", "gate"]);
  });

  it("excludes completed work from the outstanding list", () => {
    const ids = outstandingItems(resolved).map((r) => r.item.id).sort();
    expect(ids).toEqual(["d1u", "gate"]);
  });
});

describe("weekly unlock, the production default", () => {
  it("opens the whole of week one on day one", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: true,
      unlockMode: "weekly",
    });
    // Day 5's quiz is available on the start Monday under weekly.
    expect(stateOf(r, "d5q")).toBe("available");
    // Week two is still shut.
    expect(stateOf(r, "d8s")).toBe("locked");
  });

  it("still holds week three back until its Monday", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: "2026-09-07",
      hasBaseline: true,
      unlockMode: "weekly",
    });
    expect(stateOf(r, "d8s")).toBe("available");
    expect(stateOf(r, "d15v")).toBe("locked");
  });

  it("still refuses everything without a baseline", () => {
    const r = resolveItemStates({
      items,
      startDate: START,
      today: START,
      hasBaseline: false,
      unlockMode: "weekly",
    });
    expect(stateOf(r, "d1v")).toBe("locked");
    expect(stateOf(r, "gate")).toBe("available");
  });
});
