/**
 * Which track items count as done, in ONE place.
 *
 * Two things can complete a programme item and they live in different tables:
 *
 *   - `programme_item_progress` - the durable, monotonic record the track
 *     writes. Gates and reports read it.
 *   - `learn_video_completions` - Learn's own "I've finished this" toggle,
 *     shared with the video library, which predates the programme entirely.
 *
 * Reading the UNION means a video ticked in Learn still counts on the track,
 * and reading item_progress as part of that union means un-ticking in Learn
 * cannot regress somebody who has already been credited.
 *
 * This module exists because the union was previously spelled out inline in
 * `track-data.ts` and NOT in `complete-action.ts`, which computed the same
 * gate from item_progress alone. The two disagreed: someone working through
 * the library saw every gate green on their track page and was never stamped
 * complete, so the DM that tells a person they have finished never fired.
 * Same inputs, one function, one answer.
 *
 * ## Why completions are scoped to `joined_at`
 *
 * The library ran for months before the programme did, and six people had
 * already ticked videos off in it - two of them all twelve. Counting those
 * would open their track with G1 already passed and future days showing
 * complete before they unlocked: three weeks of programme, finished on the
 * first morning, by people who had watched the videos in a completely
 * different context and never done a single use example.
 *
 * So a library completion counts only if it was made AT OR AFTER the moment
 * that person joined the cohort. Nothing is deleted - their library history is
 * theirs and stays exactly as it was - it simply does not pre-credit
 * programme work they have not done yet. Anyone who re-watches during the
 * cohort is credited normally, from either surface.
 */

export type CompletableItem = {
  id: string;
  learn_video_id?: string | null;
};

export type ProgressRow = {
  track_item_id: string;
  status: string;
};

export type LearnCompletionRow = {
  video_id: string;
  /** When the tick was made. Compared against the member's joined_at. */
  created_at: string;
};

/**
 * The set of item ids this member has completed.
 *
 * `joinedAt` is the cohort membership's timestamp. Pass null to count every
 * library completion regardless of date - only the admin preview run wants
 * that, and only because it has no real history to protect.
 */
export function resolveCompletedItemIds(input: {
  items: readonly CompletableItem[];
  progress: readonly ProgressRow[];
  learnCompletions: readonly LearnCompletionRow[];
  joinedAt: string | null;
}): Set<string> {
  const recorded = new Set(
    input.progress.filter((p) => p.status === "complete").map((p) => p.track_item_id),
  );

  const joinedMs = input.joinedAt ? Date.parse(input.joinedAt) : null;
  const countsFromLearn = new Set<string>();
  for (const c of input.learnCompletions) {
    if (joinedMs !== null && Number.isFinite(joinedMs)) {
      const madeMs = Date.parse(c.created_at);
      // An unparseable timestamp is not a reason to credit work - and not a
      // reason to lose it either, so it falls back to the durable record.
      if (!Number.isFinite(madeMs) || madeMs < joinedMs) continue;
    }
    countsFromLearn.add(c.video_id);
  }

  const completed = new Set<string>();
  for (const item of input.items) {
    if (recorded.has(item.id)) {
      completed.add(item.id);
      continue;
    }
    if (item.learn_video_id && countsFromLearn.has(item.learn_video_id)) {
      completed.add(item.id);
    }
  }
  return completed;
}
