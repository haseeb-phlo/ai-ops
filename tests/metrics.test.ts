import { describe, it, expect } from "vitest";
import { calculateMetricDelta } from "@/lib/metrics";

describe("calculateMetricDelta", () => {
  it("treats 30 mins -> 20 mins as a 33% improvement (good)", () => {
    const result = calculateMetricDelta(30, 20);
    expect(result).toEqual({
      state: "good",
      percentChange: 33,
      direction: "down",
    });
  });

  it("treats 5 errors -> 8 errors as a 60% increase (bad)", () => {
    const result = calculateMetricDelta(5, 8);
    expect(result).toEqual({
      state: "bad",
      percentChange: 60,
      direction: "up",
    });
  });

  it("returns 'no baseline' state when baseline is missing", () => {
    expect(calculateMetricDelta(null, 20)).toEqual({ state: "no baseline" });
    expect(calculateMetricDelta(undefined, 20)).toEqual({
      state: "no baseline",
    });
  });

  it("returns 'no data' state when current is missing", () => {
    expect(calculateMetricDelta(30, null)).toEqual({ state: "no data" });
    expect(calculateMetricDelta(30, undefined)).toEqual({ state: "no data" });
  });
});
