/**
 * Which cohort membership a request is about.
 *
 * For most of the company this is a non-question: one person, one cohort. It
 * stops being one the moment preview runs exist, because an admin previewing
 * the programme is deliberately in two cohorts at once - their real one and a
 * sandbox - on the SAME track. Every reader and every writer then has to pick,
 * and picking differently is how a sandbox submission ends up filed against a
 * real cohort, or a real video tick lands in the sandbox and vanishes from
 * reporting.
 *
 * So there is one rule, here, and both sides use it:
 *
 *   1. If the caller says which cohort they are looking at, that one. The page
 *      already knows - it is in the URL - and the answer should not be guessed
 *      when it has been stated.
 *   2. Otherwise a REAL cohort always beats a sandbox. Somebody's actual
 *      programme is never quietly replaced by their preview of it.
 *   3. Otherwise an active cohort beats a finished one, then most recently
 *      joined wins.
 *
 * Lives beside the loader rather than inside it because a `"use server"` file
 * may only export async functions, which is also what makes it unit-testable -
 * the same split as workflows' permissions.ts.
 */

export type MembershipLike = {
  cohortId: string;
  joinedAt: string;
  status: string;
  isTest: boolean;
};

/** Active before finished. Anything unrecognised sorts last. */
const STATUS_RANK: Record<string, number> = {
  live: 0,
  planned: 1,
  complete: 2,
  archived: 3,
};

/**
 * Ranked by rule 3, so callers that need the runners-up (the "you also have a
 * preview run" links) get them in the same order the winner was chosen from.
 */
export function rankMemberships<T extends MembershipLike>(
  memberships: readonly T[],
): T[] {
  return [...memberships].sort(
    (a, b) =>
      (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
      b.joinedAt.localeCompare(a.joinedAt),
  );
}

/**
 * The membership a request is about, or undefined when the person is in no
 * cohort at all.
 *
 * `preferredCohortId` is only honoured when the caller is actually a member of
 * it. It arrives from a URL or a form field, so it is a request, not a claim -
 * an id for somebody else's cohort falls through to the default rather than
 * being trusted.
 */
export function pickMembership<T extends MembershipLike>(
  memberships: readonly T[],
  preferredCohortId?: string | null,
): T | undefined {
  const ranked = rankMemberships(memberships);
  return (
    (preferredCohortId
      ? ranked.find((m) => m.cohortId === preferredCohortId)
      : undefined) ??
    ranked.find((m) => !m.isTest) ??
    ranked[0]
  );
}
