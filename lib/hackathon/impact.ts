/**
 * Frequency x duration -> hours per person per week.
 *
 * The build sheet prints this as a 5x5 table and tells the organiser to add
 * the column in Excel before shortlisting. Doing it here is what makes the
 * problem bank sortable: free-text problems only order once each carries a
 * number.
 *
 * THE TABLE IS TRANSCRIBED, NOT COMPUTED. Its cells are midpoint arithmetic
 * rounded for print - multipliers of 15 / 5 / 3 / 1 / 0.7 per week against
 * duration midpoints of 2.5, 10, 22.5, 45 and 75 minutes - and recomputing
 * would disagree with the printed sheet in two places: "Over an hour" needs
 * a 75-minute midpoint to reach the sheet's 19, 6, 4, 1.3 and 0.9 (a
 * 60-minute floor gives 15, 5, 3, 1, 0.7), and "About once a week / Under 5
 * minutes" prints 0.05 where 2.5 minutes an hour rounds to 0.04. People read
 * this number beside the sheet they were sent, so the sheet wins.
 *
 * `atLeast` carries the sheet's trailing "+": "Over an hour" is unbounded,
 * so every figure in that column is a floor, not an estimate. A problem
 * someone spends two hours on, fifteen times a week, is not 19 hours.
 */

import {
  DURATION_OPTIONS,
  FREQUENCY_OPTIONS,
  type DurationOption,
  type FrequencyOption,
} from "./questions";

export type HoursPerWeek = {
  /** Hours per person per week. A floor when `atLeast` is set. */
  hours: number;
  /** True for the open-ended "Over an hour" column. */
  atLeast: boolean;
};

/**
 * Rows in FREQUENCY_OPTIONS order, columns in DURATION_OPTIONS order, copied
 * cell for cell from the sheet. Column five carries the "+".
 */
const HOURS_TABLE: readonly (readonly number[])[] = [
  [0.6, 2.5, 5.6, 11, 19], // Several times a day (x15/wk)
  [0.2, 0.8, 1.9, 3.8, 6], // About once a day (x5/wk)
  [0.1, 0.5, 1.1, 2.3, 4], // A few times a week (x3/wk)
  [0.05, 0.2, 0.4, 0.8, 1.3], // About once a week (x1/wk)
  [0.03, 0.1, 0.3, 0.5, 0.9], // A few times a month (x0.7/wk)
];

/** Index of the unbounded duration bucket. */
const OPEN_ENDED_COLUMN = DURATION_OPTIONS.length - 1;

/**
 * Hours per week for one answered pair, or null when either answer is
 * missing or is not one of the bank's options.
 *
 * Returns null rather than throwing or defaulting to zero: a response with
 * an unrecognised frequency is a response whose size is unknown, and a zero
 * would sort it to the bottom of the bank as though it were the cheapest
 * problem in the company.
 */
export function hoursPerWeek(
  frequency: string | null | undefined,
  duration: string | null | undefined,
): HoursPerWeek | null {
  const row = FREQUENCY_OPTIONS.indexOf(frequency as FrequencyOption);
  const column = DURATION_OPTIONS.indexOf(duration as DurationOption);
  if (row < 0 || column < 0) return null;
  return {
    hours: HOURS_TABLE[row][column],
    atLeast: column === OPEN_ENDED_COLUMN,
  };
}

/** "5.6 hrs", "19+ hrs", "0.05 hrs". Null in, dash out. */
export function formatHoursPerWeek(value: HoursPerWeek | null): string {
  if (!value) return "-";
  return `${value.hours}${value.atLeast ? "+" : ""} hrs`;
}

/**
 * Sort key for the problem bank: biggest first, unknown last.
 *
 * A floor and an exact figure compare on the figure alone. Ranking "19+"
 * above "11" is right; trying to be cleverer than that (weighting the floor
 * up by some factor) would invent precision the bucket does not have.
 */
export function compareByHours(
  a: HoursPerWeek | null,
  b: HoursPerWeek | null,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.hours - a.hours;
}
