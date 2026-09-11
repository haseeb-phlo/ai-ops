import { describe, it, expect } from "vitest";
import {
  compareByHours,
  formatHoursPerWeek,
  hoursPerWeek,
  isSharedReach,
} from "@/lib/hackathon/impact";
import {
  DURATION_OPTIONS,
  FREQUENCY_OPTIONS,
} from "@/lib/hackathon/questions";

/**
 * The build sheet's own 5x5 table, retyped from the docx rather than from
 * lib/hackathon/impact.ts, so the two are checked against each other and not
 * against a shared assumption. Rows are frequencies, columns are durations,
 * both in the sheet's printed order.
 *
 * If this test and the module are ever changed together to agree on a new
 * number, the change is wrong unless the sheet changed too: people read these
 * figures beside the copy they were sent.
 */
const SHEET = {
  "Several times a day": [0.6, 2.5, 5.6, 11, 19],
  "About once a day": [0.2, 0.8, 1.9, 3.8, 6],
  "A few times a week": [0.1, 0.5, 1.1, 2.3, 4],
  "About once a week": [0.05, 0.2, 0.4, 0.8, 1.3],
  "A few times a month": [0.03, 0.1, 0.3, 0.5, 0.9],
} as const;

describe("hoursPerWeek", () => {
  it("reproduces every cell of the build sheet's table", () => {
    for (const frequency of FREQUENCY_OPTIONS) {
      DURATION_OPTIONS.forEach((duration, column) => {
        const result = hoursPerWeek(frequency, duration);
        expect(result, `${frequency} / ${duration}`).not.toBeNull();
        expect(result!.hours, `${frequency} / ${duration}`).toBe(
          SHEET[frequency][column],
        );
      });
    }
  });

  it("covers the whole grid, so neither list can gain an option silently", () => {
    expect(FREQUENCY_OPTIONS).toHaveLength(5);
    expect(DURATION_OPTIONS).toHaveLength(5);
    expect(Object.keys(SHEET)).toEqual([...FREQUENCY_OPTIONS]);
  });

  it("marks only the open-ended duration as a floor", () => {
    for (const frequency of FREQUENCY_OPTIONS) {
      for (const duration of DURATION_OPTIONS) {
        expect(hoursPerWeek(frequency, duration)!.atLeast).toBe(
          duration === "Over an hour",
        );
      }
    }
  });

  it("returns null rather than zero for a missing or unrecognised answer", () => {
    // Zero would rank an unsized problem as the cheapest in the company.
    expect(hoursPerWeek(null, "Under 5 minutes")).toBeNull();
    expect(hoursPerWeek("Several times a day", null)).toBeNull();
    expect(hoursPerWeek(undefined, undefined)).toBeNull();
    expect(hoursPerWeek("several times a day", "Under 5 minutes")).toBeNull();
    expect(hoursPerWeek("Twice a fortnight", "Under 5 minutes")).toBeNull();
  });
});

describe("formatHoursPerWeek", () => {
  it("keeps the sheet's plus on the open-ended column", () => {
    expect(
      formatHoursPerWeek(hoursPerWeek("Several times a day", "Over an hour")),
    ).toBe("19+ hrs");
  });

  it("prints an exact bucket without a plus", () => {
    expect(
      formatHoursPerWeek(hoursPerWeek("Several times a day", "15 to 30 minutes")),
    ).toBe("5.6 hrs");
  });

  it("does not round a small figure away", () => {
    expect(
      formatHoursPerWeek(hoursPerWeek("About once a week", "Under 5 minutes")),
    ).toBe("0.05 hrs");
  });

  it("shows a dash when there is nothing to show", () => {
    expect(formatHoursPerWeek(null)).toBe("-");
  });
});

describe("compareByHours", () => {
  const big = hoursPerWeek("Several times a day", "30 to 60 minutes"); // 11
  const small = hoursPerWeek("A few times a month", "Under 5 minutes"); // 0.03
  const floor = hoursPerWeek("About once a day", "Over an hour"); // 6+

  it("sorts biggest first", () => {
    expect([small, big, floor].sort(compareByHours)).toEqual([
      big,
      floor,
      small,
    ]);
  });

  it("sorts unsized responses last, whichever side they arrive on", () => {
    expect(compareByHours(null, small)).toBeGreaterThan(0);
    expect(compareByHours(small, null)).toBeLessThan(0);
    expect(compareByHours(null, null)).toBe(0);
  });

  it("compares a floor on its figure alone", () => {
    // 11 exact beats 6+; inventing a weighting for the open bucket would be
    // precision the bucket does not have.
    expect(compareByHours(big, floor)).toBeLessThan(0);
  });
});

describe("isSharedReach", () => {
  it("is true for the two answers that mean more than one person", () => {
    expect(isSharedReach("My team")).toBe(true);
    expect(isSharedReach("Several teams")).toBe(true);
  });

  it("is false for one person, an unknown, and no answer", () => {
    expect(isSharedReach("Just me")).toBe(false);
    expect(isSharedReach("Not sure")).toBe(false);
    expect(isSharedReach(null)).toBe(false);
    expect(isSharedReach(undefined)).toBe(false);
  });
});
