import { describe, expect, it } from "vitest";
import { dayLinkPath, parseDayParam } from "@/lib/programme/day-link";

/**
 * The link that gets pasted into Slack every morning.
 *
 * The parsing matters more than it looks: this value arrives from a URL a
 * human retyped or a Slack unfurl mangled, and the failure mode of trusting
 * it is a member landing on an empty focus card with no way to tell what went
 * wrong. Everything unusable resolves to null, which the page reads as "no day
 * asked for" and answers with today.
 */

/** A full 15-day cohort. */
const DAYS = Array.from({ length: 15 }, (_, i) => i + 1);

describe("dayLinkPath", () => {
  it("is the track page with the day named", () => {
    expect(dayLinkPath(3)).toBe("/learn/track?day=3");
    expect(dayLinkPath(15)).toBe("/learn/track?day=15");
  });

  it("names no cohort, so it resolves to the follower's own track", () => {
    // A link in a channel is read by members of more than one cohort. Pinning
    // one would send the others to a track they cannot see.
    expect(dayLinkPath(3)).not.toContain("cohort");
  });

  it("round-trips through the parser", () => {
    for (const day of DAYS) {
      const query = dayLinkPath(day).split("day=")[1];
      expect(parseDayParam(query, DAYS), `day ${day}`).toBe(day);
    }
  });
});

describe("parseDayParam", () => {
  it("reads a day the cohort has", () => {
    expect(parseDayParam("3", DAYS)).toBe(3);
    expect(parseDayParam("1", DAYS)).toBe(1);
    expect(parseDayParam("15", DAYS)).toBe(15);
  });

  it("is null when no day was asked for", () => {
    expect(parseDayParam(undefined, DAYS)).toBeNull();
  });

  it("is null for a day outside the programme", () => {
    for (const raw of ["16", "99", "0", "-2"]) {
      expect(parseDayParam(raw, DAYS), raw).toBeNull();
    }
  });

  it("rejects day 0, which is the entry gate rather than a timeline day", () => {
    // The check-in renders as its own gate card, not as a row in the focus
    // carousel, so there is nothing for ?day=0 to select.
    expect(parseDayParam("0", DAYS)).toBeNull();
  });

  it("rejects what only looks like a number", () => {
    // `Number("3.5")` is 3.5 and `Number("")` is 0 - both would sail past a
    // bare `Number(x) > 0` check, which is what this used to be.
    // "1e1" is the one that actually got through and opened day ten.
    for (const raw of [
      "abc",
      "",
      " ",
      "3.5",
      "3px",
      "1e1",
      "NaN",
      "Infinity",
      "+3",
      " 3 ",
      "0x3",
      "3,",
    ]) {
      expect(parseDayParam(raw, DAYS), JSON.stringify(raw)).toBeNull();
    }
  });

  it("is null for a day this particular cohort does not have", () => {
    // A track is whatever its items say it is. A link to day 12 of a cohort
    // that only has ten days is as wrong as a link to day 99.
    const short = [1, 2, 3, 4, 5];
    expect(parseDayParam("12", short)).toBeNull();
    expect(parseDayParam("4", short)).toBe(4);
  });
});
