/**
 * Who may see the training, and how much of it.
 *
 * Learn used to be an open library: twelve videos, grouped by topic, visible
 * to all 138 people whether or not they were on the programme. That made three
 * things true at once, and the third one is why this module exists.
 *
 *   1. Somebody with no cohort could browse the whole catalogue.
 *   2. A cohort member on day one could see - and tick off - the video for day
 *      eleven, sitting in the grid beside the one they were actually asked to
 *      watch. The programme's fifteen-day shape existed only inside
 *      /learn/track; the library beside it contradicted it on the same screen.
 *   3. Ticking a video in the library completed the matching track day, so the
 *      entry check-in could be walked around entirely.
 *
 * So access is now a gate with three states, and every Learn surface branches
 * on the same one rather than deciding for itself:
 *
 *   "locked"  - not in a cohort. Nothing is shown. The programme runs in
 *               cohorts and this is what waiting for yours looks like.
 *   "checkin" - in a cohort, but the mandatory 3-minute check-in has not been
 *               done. Nothing is shown except the check-in itself, which is
 *               the entire point of calling it mandatory: it is the before
 *               half of a before-and-after measurement, and it has to be
 *               collected before the content moves the thing it measures.
 *   "open"    - in a cohort and past the gate. The track decides what is
 *               visible day by day.
 *
 * The check-in page itself is deliberately NOT gated by this - it is the key,
 * and a locked key is just a locked door. Nor is the admin's own library
 * management: somebody has to be able to add the videos.
 */

export type LearnAccess = "locked" | "checkin" | "open";

export function learnAccess(input: {
  /** True when loadTrackState returned a cohort for this person. */
  inCohort: boolean;
  /**
   * The track's own entry-gate answer: a cohort_baseline response exists, or
   * this is a preview run where the gate has nothing to measure.
   */
  entryGateOpen: boolean;
}): LearnAccess {
  if (!input.inCohort) return "locked";
  return input.entryGateOpen ? "open" : "checkin";
}

/**
 * Whether this person may manage the video library.
 *
 * Real role, never the effective one: a super admin viewing as a member must
 * see the member's gate, not an editing surface. Same rule as every mutation
 * guard in the app.
 */
export function canManageLibrary(realRole: string): boolean {
  return realRole === "super_admin";
}
