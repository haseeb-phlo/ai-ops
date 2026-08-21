import { describe, it, expect } from "vitest";
import {
  deriveSessionDates,
  generateJoinCode,
  isMonday,
  toSessionDatesJson,
  upcomingMondays,
  validateCohortSetup,
} from "@/lib/programme/cohort-setup";

const SESSIONS = [
  { trackItemId: "s1", title: "Live session 1", dayIndex: 3 },
  { trackItemId: "s2", title: "Live session 2", dayIndex: 8 },
  { trackItemId: "s3", title: "Live session 3", dayIndex: 13 },
];
const START = "2026-08-31"; // Monday

describe("isMonday / upcomingMondays", () => {
  it("identifies Mondays", () => {
    expect(isMonday("2026-08-31")).toBe(true);
    expect(isMonday("2026-09-01")).toBe(false);
  });

  it("starts from the given day when it is already a Monday", () => {
    expect(upcomingMondays(START, 3)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("rolls forward to the next Monday otherwise", () => {
    expect(upcomingMondays("2026-09-02", 2)).toEqual([
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("returns only Mondays", () => {
    for (const d of upcomingMondays("2026-09-03", 8)) {
      expect(isMonday(d)).toBe(true);
    }
  });
});

describe("deriveSessionDates", () => {
  const derived = deriveSessionDates({ startDate: START, sessions: SESSIONS });

  it("puts each session on the working day its item sits on", () => {
    expect(derived.map((d) => d.dates[0])).toEqual([
      "2026-09-02", // day 3
      "2026-09-09", // day 8
      "2026-09-16", // day 13
    ]);
  });

  it("gives a single-slot session exactly one date", () => {
    for (const d of derived) expect(d.dates).toHaveLength(1);
  });

  it("gives a dual-slot session the next working day as its second slot", () => {
    const dual = deriveSessionDates({
      startDate: START,
      sessions: SESSIONS,
      dualSlotItemIds: new Set(["s1"]),
    });
    expect(dual[0].dates).toEqual(["2026-09-02", "2026-09-03"]);
    expect(dual[1].dates).toHaveLength(1);
  });

  it("skips the weekend when a second slot would land on one", () => {
    // Day 5 is a Friday, so its second slot must be the following Monday.
    const friday = deriveSessionDates({
      startDate: START,
      sessions: [{ trackItemId: "x", title: "S", dayIndex: 5 }],
      dualSlotItemIds: new Set(["x"]),
    });
    expect(friday[0].dates).toEqual(["2026-09-04", "2026-09-07"]);
  });

  it("orders sessions by day regardless of input order", () => {
    const shuffled = deriveSessionDates({
      startDate: START,
      sessions: [SESSIONS[2], SESSIONS[0], SESSIONS[1]],
    });
    expect(shuffled.map((s) => s.dayIndex)).toEqual([3, 8, 13]);
  });
});

describe("toSessionDatesJson", () => {
  it("keys dates by track item id, which is the stored shape", () => {
    const json = toSessionDatesJson(
      deriveSessionDates({ startDate: START, sessions: SESSIONS }),
    );
    expect(json).toEqual({
      s1: ["2026-09-02"],
      s2: ["2026-09-09"],
      s3: ["2026-09-16"],
    });
  });

  it("omits a session with no dates rather than storing an empty array", () => {
    const json = toSessionDatesJson([
      { trackItemId: "s1", title: "S", dayIndex: 3, dates: [] },
    ]);
    expect(json).toEqual({});
  });
});

describe("generateJoinCode", () => {
  it("prefixes with a recognisable part of the cohort name", () => {
    expect(generateJoinCode("Cohort 1", () => 0)).toMatch(/^COHORT/);
  });

  it("falls back to PHLO when the name has nothing usable", () => {
    expect(generateJoinCode("!!!", () => 0)).toMatch(/^PHLO-/);
  });

  it("avoids characters that get misread aloud", () => {
    // No vowels (so it can't spell anything), and no 0/O or 1/I.
    const suffix = generateJoinCode("Cohort 1", () => 0.5).split("-")[1];
    expect(suffix).not.toMatch(/[AEIOU01]/);
  });

  it("produces a four-character suffix", () => {
    expect(generateJoinCode("Cohort 1", () => 0.3).split("-")[1]).toHaveLength(4);
  });
});

describe("validateCohortSetup", () => {
  const derived = deriveSessionDates({ startDate: START, sessions: SESSIONS });

  it("accepts a well-formed cohort", () => {
    expect(
      validateCohortSetup({ name: "Cohort 1", startDate: START, sessions: derived }),
    ).toEqual([]);
  });

  it("requires a name", () => {
    expect(
      validateCohortSetup({ name: "   ", startDate: START, sessions: derived }),
    ).toContain("name_required");
  });

  it("requires a Monday start", () => {
    expect(
      validateCohortSetup({
        name: "Cohort 1",
        startDate: "2026-09-02",
        sessions: derived,
      }),
    ).toContain("start_not_a_monday");
  });

  it("rejects a session scheduled before the cohort starts", () => {
    expect(
      validateCohortSetup({
        name: "Cohort 1",
        startDate: START,
        sessions: [{ ...SESSIONS[0], dates: ["2026-08-01"] }],
      }),
    ).toContain("session_date_before_start");
  });

  it("rejects two sessions sharing a date", () => {
    // Attendance becomes ambiguous for anyone who was at "the session that day".
    expect(
      validateCohortSetup({
        name: "Cohort 1",
        startDate: START,
        sessions: [
          { ...SESSIONS[0], dates: ["2026-09-02"] },
          { ...SESSIONS[1], dates: ["2026-09-02"] },
        ],
      }),
    ).toContain("duplicate_session_date");
  });
});
