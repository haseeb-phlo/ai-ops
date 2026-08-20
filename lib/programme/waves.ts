/**
 * Wave ordering.
 *
 * Split out of ai-score.ts because that module is `server-only` and therefore
 * unimportable by the test runner - the same reason permissions.ts sits beside
 * workflows' actions.ts. These are pure and worth pinning.
 */

import type { Wave } from "./questions";

/** Chronological order. Everything "previous wave" derives from this. */
export const WAVE_ORDER: readonly Wave[] = [
  "may_2026",
  "cohort_baseline",
  "post",
  "day_90",
] as const;

/** The wave a given wave is compared against on the result screen. */
export function priorWaveFor(wave: Wave): Wave | null {
  const index = WAVE_ORDER.indexOf(wave);
  return index <= 0 ? null : WAVE_ORDER[index - 1];
}

/**
 * The most recent existing wave earlier than `target` - what a new response
 * pre-fills from. A returner filling cohort_baseline pre-fills from May; post
 * pre-fills from cohort_baseline; day_90 from post.
 */
export function prefillSourceFor<T extends { wave: Wave }>(
  target: Wave,
  waves: readonly T[],
): T | null {
  const targetIndex = WAVE_ORDER.indexOf(target);
  const earlier = waves
    .filter((w) => WAVE_ORDER.indexOf(w.wave) < targetIndex)
    .sort((a, b) => WAVE_ORDER.indexOf(a.wave) - WAVE_ORDER.indexOf(b.wave));
  return earlier.length > 0 ? earlier[earlier.length - 1] : null;
}
