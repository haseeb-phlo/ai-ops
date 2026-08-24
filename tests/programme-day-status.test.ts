import { describe, it, expect } from "vitest";
import {
  dayAwaitsContent,
  daySpine,
  dayStatus,
  type DayItemLike,
  type DayStatus,
} from "@/lib/programme/day-status";

const video = (state: string, awaitingVideo = false): DayItemLike => ({
  state,
  awaitingVideo,
});

describe("what a day of the timeline is doing", () => {
  it("is locked when nothing on it has opened", () => {
    expect(dayStatus([video("locked"), video("locked")], false)).toBe("locked");
  });

  it("stays locked even on the day itself", () => {
    // A cohort whose start date is corrected forward should not label a locked
    // day "today" and invite someone to act on it.
    expect(dayStatus([video("locked")], true)).toBe("locked");
  });

  it("is awaiting when the only thing left is a video we have not recorded", () => {
    expect(dayStatus([video("available", true)], false)).toBe("awaiting");
  });

  it("is complete when everything actionable is done", () => {
    expect(dayStatus([video("complete"), video("complete")], false)).toBe(
      "complete",
    );
  });

  it("is complete when the only unfinished thing is an unrecorded video", () => {
    // The member has done everything they could. Holding the day open for our
    // backlog would show them a to-do they cannot action.
    expect(
      dayStatus([video("complete"), video("available", true)], false),
    ).toBe("complete");
  });

  it("is open when work remains, and current when that day is today", () => {
    const items = [video("complete"), video("available")];
    expect(dayStatus(items, false)).toBe("open");
    expect(dayStatus(items, true)).toBe("current");
  });

  it("does not count an unrecorded video as work outstanding", () => {
    // Guards the ordering: `awaiting` is checked before `complete`, so a day
    // that is ONLY an unrecorded video must not read as finished.
    expect(dayStatus([video("available", true)], true)).toBe("awaiting");
  });

  it("treats an empty day as locked rather than finished", () => {
    expect(dayStatus([], false)).toBe("locked");
  });
});

describe("the spine below a day marker", () => {
  const ALL: DayStatus[] = [
    "complete",
    "current",
    "open",
    "locked",
    "awaiting",
  ];

  it("has a style for every status, so no day renders without a spine", () => {
    for (const s of ALL) expect(daySpine(s, false), s).toBeTruthy();
  });

  it("colours by progress, independently of what we owe", () => {
    expect(daySpine("complete", false)).toContain("border-success");
    // Finishing a day whose video is still unrecorded keeps the member's
    // green. The debt is ours; it should not take their progress away.
    expect(daySpine("complete", true)).toContain("border-success");
  });

  it("dashes a reachable day that is still waiting on a recording", () => {
    expect(daySpine("open", true)).toContain("border-dashed");
    expect(daySpine("open", false)).not.toContain("border-dashed");
  });

  it("does not dash a locked day", () => {
    // Most of a 15-day track is locked on day one. Dashing every future day
    // with an unrecorded video would turn the signal into wallpaper.
    expect(daySpine("locked", true)).not.toContain("border-dashed");
  });

  it("uses only palette tokens, never a raw colour", () => {
    // The contrast test polices globals.css; this polices the call site.
    for (const s of ALL) {
      for (const owed of [true, false]) {
        expect(daySpine(s, owed)).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
      }
    }
  });
});

describe("spotting a day we still owe a recording", () => {
  it("is true when any item is awaiting, false when none is", () => {
    expect(dayAwaitsContent([video("complete"), video("open", true)])).toBe(
      true,
    );
    expect(dayAwaitsContent([video("complete"), video("open")])).toBe(false);
    expect(dayAwaitsContent([])).toBe(false);
  });
});
