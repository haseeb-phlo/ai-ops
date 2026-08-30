import { describe, it, expect } from "vitest";
import {
  computeRag,
  isWithinJoinerGrace,
  JOINER_GRACE_WORKING_DAYS,
  type RagInput,
} from "@/lib/programme/rag";

const START = "2026-08-31"; // Monday

const onTrack: RagInput = {
  overdueCount: 0,
  hasOutstandingRejection: false,
  hasImpossibleGate: false,
  joinedOn: START,
  cohortStartDate: START,
  today: "2026-09-09",
};

describe("thresholds", () => {
  it("is green with nothing late", () => {
    expect(computeRag(onTrack)).toBe("green");
  });

  it("is GREEN with exactly one late item", () => {
    // The playbook defines green as 0 and amber as 2-4, leaving 1 undefined.
    // One item left over from yesterday is normal progress, so it stays green.
    expect(computeRag({ ...onTrack, overdueCount: 1 })).toBe("green");
  });

  it("turns amber at two", () => {
    expect(computeRag({ ...onTrack, overdueCount: 2 })).toBe("amber");
  });

  it("stays amber through four", () => {
    expect(computeRag({ ...onTrack, overdueCount: 4 })).toBe("amber");
  });

  it("turns red at five", () => {
    expect(computeRag({ ...onTrack, overdueCount: 5 })).toBe("red");
  });

  it("stays red well beyond five", () => {
    expect(computeRag({ ...onTrack, overdueCount: 30 })).toBe("red");
  });
});

describe("rejected submissions", () => {
  it("makes an otherwise-green member amber", () => {
    expect(
      computeRag({ ...onTrack, hasOutstandingRejection: true }),
    ).toBe("amber");
  });

  it("does not downgrade a red member", () => {
    expect(
      computeRag({
        ...onTrack,
        overdueCount: 6,
        hasOutstandingRejection: true,
      }),
    ).toBe("red");
  });
});

describe("impossible gates", () => {
  it("is red even with everything else complete", () => {
    // Every session slot passed with no attendance: nothing can fix it.
    expect(computeRag({ ...onTrack, hasImpossibleGate: true })).toBe("red");
  });

  it("outranks the joiner grace window", () => {
    expect(
      computeRag({
        ...onTrack,
        hasImpossibleGate: true,
        joinedOn: "2026-09-09",
        today: "2026-09-09",
      }),
    ).toBe("red");
  });
});

describe("mid-cohort joiner grace", () => {
  it("does not apply to someone who started with the cohort", () => {
    expect(
      isWithinJoinerGrace({
        joinedOn: START,
        cohortStartDate: START,
        today: "2026-09-01",
      }),
    ).toBe(false);
  });

  it("holds a late joiner at green despite a backlog", () => {
    expect(
      computeRag({
        ...onTrack,
        overdueCount: 4,
        joinedOn: "2026-09-09",
        today: "2026-09-11", // 2 working days in
      }),
    ).toBe("green");
  });

  it("expires after five working days", () => {
    expect(
      computeRag({
        ...onTrack,
        overdueCount: 4,
        joinedOn: "2026-09-09", // Wednesday
        today: "2026-09-16", // 5 working days later
      }),
    ).toBe("amber");
  });

  it("spans a weekend without burning grace", () => {
    // Joined Thursday; the following Monday is only 2 working days on.
    expect(
      isWithinJoinerGrace({
        joinedOn: "2026-09-10",
        cohortStartDate: START,
        today: "2026-09-14",
      }),
    ).toBe(true);
  });

  it("never rescues a late joiner from red", () => {
    // Grace softens amber, not the >=5 threshold.
    expect(
      computeRag({
        ...onTrack,
        overdueCount: 5,
        joinedOn: "2026-09-09",
        today: "2026-09-10",
      }),
    ).toBe("red");
  });

  it("uses the documented grace length", () => {
    expect(JOINER_GRACE_WORKING_DAYS).toBe(5);
  });
});
