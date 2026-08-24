import { describe, it, expect } from "vitest";
import {
  ACTIVITY_STEPS,
  activityStep,
  cohortMix,
  describeDay,
  rampWash,
  youMix,
  type DayActivity,
} from "@/lib/programme/activity";

const day = (over: Partial<DayActivity> = {}): DayActivity => ({
  dayIndex: 3,
  you: 0,
  cohort: null,
  awaitsContent: false,
  locked: false,
  ...over,
});

describe("quantising a day's share", () => {
  it("is zero only when nothing was done", () => {
    expect(activityStep(0)).toBe(0);
    expect(activityStep(-1)).toBe(0);
    expect(activityStep(Number.NaN)).toBe(0);
  });

  it("lifts any progress at all off zero", () => {
    // A day with one of eight items done must not read as an untouched day.
    expect(activityStep(0.01)).toBe(1);
    expect(activityStep(0.125)).toBe(1);
  });

  it("reaches the top step only at complete", () => {
    expect(activityStep(0.99)).toBeLessThan(ACTIVITY_STEPS);
    expect(activityStep(1)).toBe(ACTIVITY_STEPS);
    expect(activityStep(2)).toBe(ACTIVITY_STEPS);
  });

  it("rises monotonically", () => {
    const steps = [0, 0.2, 0.4, 0.6, 0.8, 1].map(activityStep);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});

describe("the two wash layers", () => {
  it("keeps the cohort layer quieter than the member's at every step", () => {
    // The cohort is context, never a second reading competing with your own.
    for (let s = 1; s <= ACTIVITY_STEPS; s += 1) {
      expect(cohortMix(s), `step ${s}`).toBeLessThan(youMix(s));
    }
  });

  it("keeps the member's layer below a solid block", () => {
    // Saturated fills are for small marks; fifteen solid squares are not.
    expect(youMix(ACTIVITY_STEPS)).toBeLessThan(100);
  });

  it("paints nothing at step zero", () => {
    expect(rampWash(youMix(0))).toBe("transparent");
    expect(rampWash(cohortMix(0))).toBe("transparent");
  });

  it("mixes toward transparent, never toward the page", () => {
    // The styling rule for colour-as-data is explicit about the direction.
    const wash = rampWash(youMix(3));
    expect(wash).toContain("transparent");
    expect(wash).not.toContain("--background");
  });

  it("draws only from the chart ramp, never a raw colour", () => {
    for (let s = 0; s <= ACTIVITY_STEPS; s += 1) {
      for (const mix of [youMix(s), cohortMix(s)]) {
        expect(rampWash(mix)).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
      }
    }
    expect(rampWash(youMix(2))).toContain("var(--chart-1)");
  });
});

describe("describing a cell without colour", () => {
  it("always names the day", () => {
    expect(describeDay(day())).toContain("Day 3");
  });

  it("says the day is shut rather than empty when it has not opened", () => {
    expect(describeDay(day({ locked: true }))).toContain("not open yet");
  });

  it("distinguishes finished, part-done and untouched", () => {
    expect(describeDay(day({ you: 1 }))).toContain("you finished it");
    expect(describeDay(day({ you: 0.5 }))).toContain("50%");
    expect(describeDay(day({ you: 0 }))).toContain("have not started");
  });

  it("mentions the cohort only when it is known", () => {
    expect(describeDay(day({ cohort: 0.4 }))).toContain("cohort 40%");
    expect(describeDay(day({ cohort: null }))).not.toContain("cohort");
  });

  it("says when the gap is ours", () => {
    expect(describeDay(day({ awaitsContent: true }))).toContain(
      "video still to come",
    );
  });
});
