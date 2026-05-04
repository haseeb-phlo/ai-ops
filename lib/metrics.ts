export type MetricDelta =
  | { state: "no baseline" }
  | { state: "no data" }
  | { state: "good"; percentChange: number; direction: "up" | "down" }
  | { state: "bad"; percentChange: number; direction: "up" | "down" };

export function calculateMetricDelta(
  baseline: number | null | undefined,
  current: number | null | undefined,
  options: { lowerIsBetter?: boolean } = {},
): MetricDelta {
  const { lowerIsBetter = true } = options;

  if (baseline === null || baseline === undefined) {
    return { state: "no baseline" };
  }
  if (current === null || current === undefined) {
    return { state: "no data" };
  }

  const change = current - baseline;
  const percentChange = Math.round(Math.abs(change / baseline) * 100);
  const direction: "up" | "down" = change >= 0 ? "up" : "down";
  const isGood = lowerIsBetter ? change < 0 : change > 0;

  return {
    state: isGood ? "good" : "bad",
    percentChange,
    direction,
  };
}
