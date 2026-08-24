/**
 * Fifteen days of activity, as a sequential heatmap.
 *
 * This is the one place in the app that paints a surface with colour rather
 * than putting a dot beside a label. The styling rules allow it for exactly
 * this case - "colour-as-data (a matrix/diff/heatmap MAY wash a surface, from
 * the categorical ramp only, mixed toward transparent and never toward
 * --background, with the text staying ink or a link)" - and note it has no
 * consumer yet. This is the first, so it stays inside that sentence: one hue
 * off the ramp, mixed toward transparent, ink text.
 *
 * TWO LAYERS, DELIBERATELY SEPARATED. The member's own share is the reading;
 * the cohort's is a quiet second layer behind it, so a pale cell with no solid
 * centre says "everyone else did this day and you have not" without a word of
 * nagging. They are composited with a surface ring between them rather than
 * simply stacked, because two washes of one hue laid on top of each other add
 * up and the sum encodes nothing.
 *
 * FIVE STEPS, NOT A CONTINUOUS RAMP. Past roughly seven classes adjacent bins
 * blur, and a continuous alpha invites reading precision that a share of four
 * items cannot carry.
 */

/** How many discrete steps a share is quantised to, zero included. */
export const ACTIVITY_STEPS = 4;

export type DayActivity = {
  dayIndex: number;
  /** Share of the day's actionable items this member has finished, 0 to 1. */
  you: number;
  /** The cohort's mean share for the same day; null when it is unknown. */
  cohort: number | null;
  /** True when the day is still waiting on a recording from us. */
  awaitsContent: boolean;
  /** True when the day has not unlocked yet. */
  locked: boolean;
};

/**
 * A share quantised to 0..ACTIVITY_STEPS.
 *
 * Anything above zero lands on at least step 1, so a day with some work done
 * never reads as an empty one.
 */
export function activityStep(share: number): number {
  if (!(share > 0)) return 0;
  if (share >= 1) return ACTIVITY_STEPS;
  // The top step is reserved for a FINISHED day. Scaling straight onto it
  // would round a day at 99% up to the same paint as a day that is done,
  // which on a grid whose whole job is "which days did I finish" is the one
  // mistake it cannot afford.
  return Math.min(
    ACTIVITY_STEPS - 1,
    Math.max(1, Math.ceil(share * (ACTIVITY_STEPS - 1))),
  );
}

/**
 * The percentage of the ramp hue to mix toward transparent for a step.
 *
 * The member's own layer tops out well below full strength: the styling rules
 * reserve saturated fills for small marks, and a grid of fifteen solid blocks
 * is precisely the "thick saturated blocks" a chart should not be.
 */
export function youMix(step: number): number {
  if (step <= 0) return 0;
  return [0, 22, 44, 64, 82][Math.min(step, ACTIVITY_STEPS)];
}

/**
 * The cohort layer, kept far quieter than the member's own.
 *
 * It is context, not a second reading, and at these strengths it can never be
 * mistaken for the member's own square sitting on top of it.
 */
export function cohortMix(step: number): number {
  if (step <= 0) return 0;
  return [0, 5, 9, 13, 17][Math.min(step, ACTIVITY_STEPS)];
}

/** The CSS colour for a mix percentage, or transparent at zero. */
export function rampWash(mixPercent: number): string {
  if (mixPercent <= 0) return "transparent";
  return `color-mix(in oklab, var(--chart-1) ${mixPercent}%, transparent)`;
}

/**
 * Plain-language description of one cell, for its tooltip and its screen
 * reader text. A heatmap cell that only exists as a colour is unreadable to
 * anyone who cannot see the colour, so every cell carries this.
 */
export function describeDay(day: DayActivity): string {
  const you = Math.round(day.you * 100);
  const parts = [`Day ${day.dayIndex}`];

  if (day.locked) {
    parts.push("not open yet");
  } else if (day.you >= 1) {
    parts.push("you finished it");
  } else if (day.you > 0) {
    parts.push(`you are ${you}% through`);
  } else {
    parts.push("you have not started it");
  }

  if (day.cohort !== null) {
    parts.push(`cohort ${Math.round(day.cohort * 100)}%`);
  }
  if (day.awaitsContent) {
    parts.push("video still to come");
  }
  return parts.join(", ");
}
