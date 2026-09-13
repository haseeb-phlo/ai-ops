import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_CYCLE,
  isG2Impossible,
  nextAttendanceStatus,
  satisfiedSessionIds,
  satisfiesSession,
  sessionHasPassed,
  summariseAttendance,
} from "@/lib/programme/attendance";
import { buildGateFunnel } from "@/lib/programme/funnel";
import { computeGates, type GateInput } from "@/lib/programme/gates";

describe("roster cell cycling", () => {
  it("cycles blank -> attended -> absent -> excused -> blank", () => {
    expect(nextAttendanceStatus(null)).toBe("attended");
    expect(nextAttendanceStatus("attended")).toBe("absent");
    expect(nextAttendanceStatus("absent")).toBe("excused");
    expect(nextAttendanceStatus("excused")).toBeNull();
  });

  it("covers every state exactly once per cycle", () => {
    expect(ATTENDANCE_CYCLE).toHaveLength(4);
    expect(new Set(ATTENDANCE_CYCLE).size).toBe(4);
  });
});

describe("satisfiesSession", () => {
  it("counts attendance", () => {
    expect(satisfiesSession({ trackItemId: "s1", status: "attended" })).toBe(true);
  });

  it("does NOT count a bare excusal", () => {
    // Otherwise "excused" is a free pass and G2 means nothing.
    expect(satisfiesSession({ trackItemId: "s1", status: "excused" })).toBe(false);
  });

  it("counts an excusal WITH a make-up", () => {
    expect(
      satisfiesSession({ trackItemId: "s1", status: "excused", makeUp: true }),
    ).toBe(true);
  });

  it("never counts an absence", () => {
    expect(
      satisfiesSession({ trackItemId: "s1", status: "absent", makeUp: true }),
    ).toBe(false);
  });
});

describe("dual-slot sessions", () => {
  it("is satisfied by attending either slot", () => {
    // The slot number is recorded for the organiser; it is not a second
    // hurdle. Both of these satisfy the same session item.
    const slotOne = satisfiedSessionIds([
      { trackItemId: "s1", status: "attended" },
    ]);
    const slotTwo = satisfiedSessionIds([
      { trackItemId: "s1", status: "attended" },
    ]);
    expect(slotOne.has("s1")).toBe(true);
    expect(slotTwo.has("s1")).toBe(true);
  });

  it("only counts a session as passed once its LAST slot is behind us", () => {
    // Judging on the first slot would write off anyone booked into the second.
    expect(sessionHasPassed(["2026-09-02", "2026-09-03"], "2026-09-02", "x")).toBe(false);
    expect(sessionHasPassed(["2026-09-02", "2026-09-03"], "2026-09-03", "x")).toBe(false);
    expect(sessionHasPassed(["2026-09-02", "2026-09-03"], "2026-09-04", "x")).toBe(true);
  });

  it("does not treat today's session as missed", () => {
    expect(sessionHasPassed(["2026-09-04"], "2026-09-04", "x")).toBe(false);
  });

  it("falls back to the item's own date when no slots are scheduled", () => {
    expect(sessionHasPassed([], "2026-09-10", "2026-09-04")).toBe(true);
    expect(sessionHasPassed([], "2026-09-01", "2026-09-04")).toBe(false);
  });
});

describe("isG2Impossible", () => {
  const sessions = [
    { trackItemId: "s1", slotDates: ["2026-09-02", "2026-09-03"], fallbackDate: "2026-09-02" },
    { trackItemId: "s2", slotDates: ["2026-09-09"], fallbackDate: "2026-09-09" },
  ];

  it("is false while sessions are still ahead", () => {
    expect(
      isG2Impossible({ sessions, satisfied: new Set(), today: "2026-09-01" }),
    ).toBe(false);
  });

  it("is true once a session has passed unsatisfied", () => {
    expect(
      isG2Impossible({ sessions, satisfied: new Set(), today: "2026-09-04" }),
    ).toBe(true);
  });

  it("is false when the passed session was satisfied", () => {
    expect(
      isG2Impossible({
        sessions,
        satisfied: new Set(["s1"]),
        today: "2026-09-04",
      }),
    ).toBe(false);
  });

  it("is still false on the day of the last slot", () => {
    expect(
      isG2Impossible({ sessions, satisfied: new Set(), today: "2026-09-03" }),
    ).toBe(false);
  });
});

describe("summariseAttendance", () => {
  it("counts each status and the unmarked remainder", () => {
    const summary = summariseAttendance(
      [
        { trackItemId: "s1", status: "attended" },
        { trackItemId: "s1", status: "absent" },
        { trackItemId: "s1", status: "excused", makeUp: true },
        { trackItemId: "s1", status: "excused" },
      ],
      10,
    );
    expect(summary).toEqual({
      attended: 1,
      absent: 1,
      excused: 2,
      unmarked: 6,
      satisfied: 2,
    });
  });

  it("never reports negative unmarked when everyone is marked", () => {
    const summary = summariseAttendance(
      [{ trackItemId: "s1", status: "attended" }],
      1,
    );
    expect(summary.unmarked).toBe(0);
  });
});

describe("buildGateFunnel", () => {
  const base: GateInput = {
    contentItemIds: ["a"],
    completedItemIds: new Set(["a"]),
    sessionItemIds: ["s"],
    satisfiedSessionItemIds: new Set(["s"]),
    approvedSignedExamples: 5,
    filedTaskEvidence: 0,
    capstoneCredits: 0,
    bestSummativeQuizScore: 8,
    summativeQuizPassMark: 8,
    hasPostResponse: true,
  };

  it("counts each gate independently", () => {
    const funnel = buildGateFunnel([
      computeGates(base),
      computeGates({ ...base, hasPostResponse: false }),
      computeGates({ ...base, completedItemIds: new Set() }),
    ]);
    expect(funnel.total).toBe(3);
    expect(funnel.perGate.g1).toBe(2);
    expect(funnel.perGate.g4).toBe(2);
    expect(funnel.complete).toBe(1);
  });

  it("allows a later gate to out-count an earlier one", () => {
    // G1-G4 are independent conditions, not sequential stages - someone can
    // pass G4 while failing G1. A narrowing funnel would make this look broken.
    const funnel = buildGateFunnel([
      computeGates({ ...base, completedItemIds: new Set() }),
    ]);
    expect(funnel.perGate.g1).toBe(0);
    expect(funnel.perGate.g4).toBe(1);
  });

  it("handles an empty cohort", () => {
    const funnel = buildGateFunnel([]);
    expect(funnel.total).toBe(0);
    expect(funnel.complete).toBe(0);
  });
});
