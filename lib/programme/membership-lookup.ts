import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pickMembership } from "./membership";

/**
 * The membership a mutation should write against.
 *
 * Every write on the track used to resolve this with
 * `.order("joined_at", { ascending: false }).limit(1)` - the most recently
 * joined cohort, whatever the member happened to be looking at. That was
 * harmless while nobody was in two cohorts, and became wrong the day preview
 * runs shipped: an admin previewing the programme is in their real cohort and
 * a sandbox at once, on the same track, so "newest" silently routed real
 * completions into the sandbox and sandbox submissions into the real cohort.
 * Both directions are quiet - the row saves, it just saves somewhere else.
 *
 * The page knows which cohort it is rendering, so it says so; `pickMembership`
 * falls back to the same ranking `loadTrackState` reads with, which is what
 * keeps the writer and the reader agreeing.
 *
 * Only `live` and `planned` cohorts are writable. A complete or archived
 * cohort is a record, and a member's track page still renders one - so this
 * returning null there is the intended refusal, not an oversight.
 */

export type WritableMembership = {
  id: string;
  cohortId: string;
  trackId: string;
};

export async function resolveWritableMembership(
  userId: string,
  preferredCohortId?: string | null,
): Promise<WritableMembership | null> {
  const supabase = await createClient();

  // RLS limits this to the caller's own rows, so `preferredCohortId` cannot
  // reach a cohort they are not in - an id for somebody else's falls through
  // to the default rather than being trusted.
  const { data } = await supabase
    .from("programme_cohort_members")
    .select(
      "id, cohort_id, joined_at, programme_cohorts!inner(track_id, status, is_test)",
    )
    .eq("user_id", userId)
    .in("programme_cohorts.status", ["live", "planned"])
    .returns<
      {
        id: string;
        cohort_id: string;
        joined_at: string;
        programme_cohorts: {
          track_id: string;
          status: string;
          is_test: boolean;
        };
      }[]
    >();

  const keyed = (data ?? []).map((m) => ({
    row: m,
    cohortId: m.cohort_id,
    joinedAt: m.joined_at,
    status: m.programme_cohorts.status,
    isTest: m.programme_cohorts.is_test,
  }));

  const picked = pickMembership(keyed, preferredCohortId);
  if (!picked) return null;

  return {
    id: picked.row.id,
    cohortId: picked.row.cohort_id,
    trackId: picked.row.programme_cohorts.track_id,
  };
}
