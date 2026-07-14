import "server-only";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Suggestions and initiatives share one queue, so both tables contribute to
// the current rank bounds. Queue membership: suggestions have
// status='queued'; initiatives are paused, unshipped, and ranked.

async function queueRankBound(
  supabase: ServerClient,
  ascending: boolean,
): Promise<number | null> {
  const [{ data: s }, { data: i }] = await Promise.all([
    supabase
      .from("intervention_suggestions")
      .select("queue_rank")
      .eq("status", "queued")
      .not("queue_rank", "is", null)
      .order("queue_rank", { ascending })
      .limit(1)
      .maybeSingle<{ queue_rank: number | null }>(),
    supabase
      .from("ai_interventions")
      .select("queue_rank")
      .eq("status", "paused")
      .is("shipped_at", null)
      .not("queue_rank", "is", null)
      .order("queue_rank", { ascending })
      .limit(1)
      .maybeSingle<{ queue_rank: number | null }>(),
  ]);
  const ranks = [s?.queue_rank, i?.queue_rank].filter(
    (r): r is number => r != null,
  );
  if (ranks.length === 0) return null;
  return ascending ? Math.min(...ranks) : Math.max(...ranks);
}

/**
 * Rank for a card joining the bottom of the queue - used by the roadmap
 * add dialog and the "Add to queue" status action, so entry placement
 * can't drift between them.
 */
export async function bottomQueueRank(supabase: ServerClient): Promise<number> {
  return ((await queueRankBound(supabase, false)) ?? 0) + 1;
}

/**
 * Rank for a card taking the top of the queue - used by drag-drops into
 * the Queued lane, matching the board's optimistic insert-at-top.
 */
export async function topQueueRank(supabase: ServerClient): Promise<number> {
  return ((await queueRankBound(supabase, true)) ?? 1) - 1;
}
