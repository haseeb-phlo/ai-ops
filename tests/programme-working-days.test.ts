import { describe, it, expect } from "vitest";
import {
  addWorkingDays,
  dayOfWeek,
  finalDayDate,
  hasDayArrived,
  hasReached,
  hourInLondon,
  isWeekend,
  todayInLondon,
  unlockDateFor,
  weekOf,
  workingDaysBetween,
} from "@/lib/programme/working-days";

// 2026-08-31 is a Monday - the real Cohort 1 start date.
const START = "2026-08-31";

describe("dayOfWeek / isWeekend", () => {
  it("identifies the days of the Cohort 1 start week", () => {
    expect(dayOfWeek("2026-08-31")).toBe(1); // Monday
    expect(dayOfWeek("2026-09-04")).toBe(5); // Friday
    expect(dayOfWeek("2026-09-05")).toBe(6); // Saturday
    expect(dayOfWeek("2026-09-06")).toBe(0); // Sunday
  });

  it("treats only Saturday and Sunday as weekend", () => {
    expect(isWeekend("2026-09-04")).toBe(false);
    expect(isWeekend("2026-09-05")).toBe(true);
    expect(isWeekend("2026-09-06")).toBe(true);
    expect(isWeekend("2026-09-07")).toBe(false);
  });
});

describe("addWorkingDays", () => {
  it("is the identity for zero", () => {
    expect(addWorkingDays(START, 0)).toBe(START);
  });

  it("does not roll a weekend forward when adding zero", () => {
    // Silently rolling would hide an off-by-one in unlockDateFor.
    expect(addWorkingDays("2026-09-05", 0)).toBe("2026-09-05");
  });

  it("skips the weekend", () => {
    expect(addWorkingDays("2026-09-04", 1)).toBe("2026-09-07"); // Fri -> Mon
  });

  it("walks a full working week", () => {
    expect(addWorkingDays(START, 4)).toBe("2026-09-04"); // Mon -> Fri
    expect(addWorkingDays(START, 5)).toBe("2026-09-07"); // Mon -> next Mon
  });

  it("crosses a month boundary", () => {
    expect(addWorkingDays("2026-08-28", 1)).toBe("2026-08-31");
  });

  it("walks backwards", () => {
    expect(addWorkingDays("2026-09-07", -1)).toBe("2026-09-04");
    expect(addWorkingDays("2026-09-07", -5)).toBe("2026-08-31");
  });

  it("rejects a malformed date rather than guessing", () => {
    expect(() => addWorkingDays("31/08/2026", 1)).toThrow();
  });
});

describe("unlockDateFor - daily mode", () => {
  it("makes the day-0 gate available from the cohort start", () => {
    expect(unlockDateFor(START, 0, "daily")).toBe(START);
  });

  it("puts day 1 on the start Monday", () => {
    expect(unlockDateFor(START, 1, "daily")).toBe(START);
  });

  it("puts day 5 on the Friday of week 1", () => {
    expect(unlockDateFor(START, 5, "daily")).toBe("2026-09-04");
    expect(dayOfWeek(unlockDateFor(START, 5, "daily"))).toBe(5);
  });

  it("puts day 10 on the Friday of week 2", () => {
    expect(unlockDateFor(START, 10, "daily")).toBe("2026-09-11");
    expect(dayOfWeek(unlockDateFor(START, 10, "daily"))).toBe(5);
  });

  it("puts day 15 on the Friday of week 3", () => {
    expect(unlockDateFor(START, 15, "daily")).toBe("2026-09-18");
    expect(dayOfWeek(unlockDateFor(START, 15, "daily"))).toBe(5);
  });

  it("never schedules a programme day on a weekend", () => {
    for (let day = 1; day <= 15; day++) {
      expect(isWeekend(unlockDateFor(START, day))).toBe(false);
    }
  });

  it("spans exactly three calendar weeks", () => {
    // 15 working days from a Monday lands 18 calendar days later.
    expect(unlockDateFor(START, 15, "daily")).toBe("2026-09-18");
  });
});

describe("workingDaysBetween", () => {
  it("is zero for the same day", () => {
    expect(workingDaysBetween(START, START)).toBe(0);
  });

  it("ignores the weekend in between", () => {
    expect(workingDaysBetween("2026-09-04", "2026-09-07")).toBe(1);
  });

  it("counts a working week as five", () => {
    expect(workingDaysBetween(START, "2026-09-07")).toBe(5);
  });

  it("goes negative when the target precedes the start", () => {
    expect(workingDaysBetween("2026-09-07", START)).toBe(-5);
  });
});

describe("hasReached", () => {
  it("is true on the day itself and after, false before", () => {
    expect(hasReached("2026-09-04", "2026-09-04")).toBe(true);
    expect(hasReached("2026-09-04", "2026-09-07")).toBe(true);
    expect(hasReached("2026-09-07", "2026-09-04")).toBe(false);
  });
});

describe("todayInLondon", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(todayInLondon()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses London time, not UTC, across the BST offset", () => {
    // 23:30 UTC on 30 Aug is already 00:30 on 31 Aug in British Summer Time.
    // A UTC-based implementation would report the 30th and unlock a day late.
    expect(todayInLondon(new Date("2026-08-30T23:30:00Z"))).toBe("2026-08-31");
  });

  it("agrees with UTC in winter, when London is GMT", () => {
    expect(todayInLondon(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });
});

describe("unlockDateFor - weekly mode, the default", () => {
  it("opens a whole week on its Monday", () => {
    // The real cadence is the three live sessions, one per week. A daily lock
    // stops a shift worker with a quiet Tuesday from working when they can,
    // and the programme already lets people catch up whenever.
    for (const day of [1, 2, 3, 4, 5]) {
      expect(unlockDateFor(START, day, "weekly")).toBe("2026-08-31");
    }
    for (const day of [6, 7, 8, 9, 10]) {
      expect(unlockDateFor(START, day, "weekly")).toBe("2026-09-07");
    }
    for (const day of [11, 12, 13, 14, 15]) {
      expect(unlockDateFor(START, day, "weekly")).toBe("2026-09-14");
    }
  });

  it("still drips, so nobody takes all fifteen days on the first morning", () => {
    expect(unlockDateFor(START, 15, "weekly")).not.toBe(
      unlockDateFor(START, 1, "weekly"),
    );
  });

  it("keeps every week opening on a Monday", () => {
    for (const day of [1, 6, 11]) {
      expect(dayOfWeek(unlockDateFor(START, day, "weekly"))).toBe(1);
    }
  });

  it("is the default when no mode is given", () => {
    expect(unlockDateFor(START, 5)).toBe(unlockDateFor(START, 5, "weekly"));
  });

  it("leaves the day-0 gate open from the start either way", () => {
    expect(unlockDateFor(START, 0, "weekly")).toBe(START);
    expect(unlockDateFor(START, 0, "daily")).toBe(START);
  });
});

describe("weekOf", () => {
  it("maps days to their week", () => {
    expect([1, 5].map(weekOf)).toEqual([1, 1]);
    expect([6, 10].map(weekOf)).toEqual([2, 2]);
    expect([11, 15].map(weekOf)).toEqual([3, 3]);
  });

  it("never returns week zero for the entry gate", () => {
    expect(weekOf(0)).toBe(1);
  });
});

describe("finalDayDate", () => {
  it("is the Friday of week 3 for a Monday start", () => {
    // 2026-09-07 is a Monday. Day 1 is that Monday, day 15 is 14 working days
    // later: Friday 2026-09-25.
    expect(finalDayDate("2026-09-07")).toBe("2026-09-25");
    expect(dayOfWeek(finalDayDate("2026-09-07"))).toBe(5);
  });

  it("is NOT the day-15 unlock date, which weekly mode puts on the Monday", () => {
    // The distinction the roundup depends on: day 15 becomes visible on the
    // Monday of week 3, but the programme ends on the Friday.
    expect(unlockDateFor("2026-09-07", 15, "weekly")).toBe("2026-09-21");
    expect(finalDayDate("2026-09-07")).toBe("2026-09-25");
  });

  it("agrees with the daily drip, which reaches day 15 on the same date", () => {
    expect(finalDayDate("2026-09-07")).toBe(
      unlockDateFor("2026-09-07", 15, "daily"),
    );
  });
});

describe("hourInLondon", () => {
  it("is an hour ahead of UTC during BST", () => {
    // 2026-09-25 is inside British Summer Time, so 15:00 UTC is 16:00 London.
    expect(hourInLondon(new Date("2026-09-25T15:00:00Z"))).toBe(16);
  });

  it("matches UTC during GMT", () => {
    // Late November is GMT, so the 16:00 UTC firing is the 4pm one.
    expect(hourInLondon(new Date("2026-11-27T16:00:00Z"))).toBe(16);
    expect(hourInLondon(new Date("2026-11-27T15:00:00Z"))).toBe(15);
  });

  it("means exactly one of the two scheduled firings is 4pm, either season", () => {
    // This is what stops the roundup going out an hour early in winter.
    const bst = ["2026-09-25T15:00:00Z", "2026-09-25T16:00:00Z"];
    const gmt = ["2026-11-27T15:00:00Z", "2026-11-27T16:00:00Z"];
    for (const season of [bst, gmt]) {
      const atOrAfter4 = season.filter(
        (iso) => hourInLondon(new Date(iso)) >= 16,
      );
      expect(atOrAfter4.length).toBeGreaterThanOrEqual(1);
    }
    // In BST the second firing is 5pm London, so it also passes the >= check
    // and is stopped by the claim instead. In GMT only one firing passes.
    expect(gmt.filter((iso) => hourInLondon(new Date(iso)) >= 16)).toHaveLength(1);
  });
});

describe("hourInLondon at midnight", () => {
  it("is 0, never 24", () => {
    // hour12:false renders midnight as "24" in some engines.
    expect(hourInLondon(new Date("2026-11-27T00:00:00Z"))).toBe(0);
  });
});

describe("hasDayArrived", () => {
  // Cohort 1A/1B start: Monday 31 August 2026.
  const startDate = "2026-08-31";

  it("counts today as arrived, so day 1 is arrived on the start Monday", () => {
    expect(
      hasDayArrived({ dayIndex: 1, startDate, today: "2026-08-31" }),
    ).toBe(true);
  });

  it("does not count the rest of the week, though weekly unlock opens it", () => {
    // The whole point: days 2-5 are AVAILABLE on the Monday but have not
    // come round. This is what keeps four extra thumbnails off day one.
    for (const dayIndex of [2, 3, 4, 5]) {
      expect(hasDayArrived({ dayIndex, startDate, today: "2026-08-31" })).toBe(
        false,
      );
    }
  });

  it("arrives a day at a time as the week goes on", () => {
    expect(hasDayArrived({ dayIndex: 2, startDate, today: "2026-09-01" })).toBe(
      true,
    );
    expect(hasDayArrived({ dayIndex: 3, startDate, today: "2026-09-01" })).toBe(
      false,
    );
  });

  it("skips the weekend, so day 6 arrives on the Monday not the Saturday", () => {
    // Day 5 is Friday 4 Sep. Day 6 is Monday 7 Sep, not Saturday 5 Sep.
    expect(hasDayArrived({ dayIndex: 6, startDate, today: "2026-09-05" })).toBe(
      false,
    );
    expect(hasDayArrived({ dayIndex: 6, startDate, today: "2026-09-07" })).toBe(
      true,
    );
  });

  it("treats past days as arrived", () => {
    expect(hasDayArrived({ dayIndex: 1, startDate, today: "2026-09-10" })).toBe(
      true,
    );
  });

  it("treats the day-0 entry gate as always arrived", () => {
    expect(hasDayArrived({ dayIndex: 0, startDate, today: "2026-08-31" })).toBe(
      true,
    );
  });
});
