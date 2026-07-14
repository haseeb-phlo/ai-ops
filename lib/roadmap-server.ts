import "server-only";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Next rank for a suggestion entering the Queued lane: one past the current
 * bottom of the queue. Shared by every "join the queue" path (the roadmap
 * add dialog and the "Add to queue" status action) so entry placement can't
 * drift between them. Explicit drag-drops into the lane are the exception -
 * they take the top (see moveSuggestionLane).
 */
export async function nextQueueRank(supabase: ServerClient): Promise<number> {
  const { data: last } = await supabase
    .from("intervention_suggestions")
    .select("queue_rank")
    .eq("status", "queued")
    .not("queue_rank", "is", null)
    .order("queue_rank", { ascending: false })
    .limit(1)
    .maybeSingle<{ queue_rank: number | null }>();
  return (last?.queue_rank ?? 0) + 1;
}
