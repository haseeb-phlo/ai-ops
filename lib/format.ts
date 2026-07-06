/**
 * Single source for number/date formatting across the app.
 *
 * Replaces the four duplicated copies that lived in the dashboard page,
 * top-wins, all-time-rail, and admin/_components/format.ts. Feature areas
 * should import from here rather than re-declaring local helpers.
 */

/** Whole-pound GBP with en-GB grouping, sign preserved: -1234.5 → "-£1,235". */
export function gbp(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}£${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/** Minutes with no unit promotion: 480 → "480 min". */
export function fmtMinutesRaw(value: number): string {
  return `${Math.round(value).toLocaleString("en-GB")} min`;
}

/**
 * Minutes with unit promotion so big totals stay readable:
 * - < 600 min → "480 min"
 * - 600–5,999 min → hours to 1dp, trailing .0 trimmed → "12.5 hrs", "10 hrs"
 * - ≥ 6,000 min (100 hrs) → whole grouped hours → "1,250 hrs"
 */
export function fmtMinutes(value: number): string {
  const abs = Math.abs(value);
  if (abs < 600) return fmtMinutesRaw(value);
  const hours = value / 60;
  if (abs < 6000) {
    const rounded = Math.round(hours * 10) / 10;
    const text = Number.isInteger(rounded)
      ? rounded.toLocaleString("en-GB")
      : rounded.toFixed(1);
    return `${text} hrs`;
  }
  return `${Math.round(hours).toLocaleString("en-GB")} hrs`;
}

/**
 * Compact relative timestamp: "just now", "5m ago", "3h ago", "12d ago",
 * then a local date once it's over ~a month old.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}
