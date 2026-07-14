// Pure helper for the Queued lane's drag-to-reorder, kept out of actions.ts
// because that file is "use server" (every export there must be an async
// Server Action).
//
// Unlike Learn's slot-reusing redeal (positions there are global and
// interleaved across topic buckets), queue_rank is scoped to the queue: only
// status='queued' rows carry one. So a reorder can simply renumber the whole
// queue 1..n — no other rows can collide.

export type QueuedRow = { id: string };

/**
 * Given the queue's current rows (in their current server order) and the
 * client's desired id order, return the queue_rank to write for each row.
 * Ids the server doesn't know about are dropped (stale client state); rows
 * the client didn't mention (e.g. queued concurrently by someone else) are
 * appended after the ordered ones, keeping their current relative order.
 */
export function renumberQueue(
  rows: QueuedRow[],
  orderedIds: string[],
): { id: string; queue_rank: number }[] {
  const known = new Set(rows.map((r) => r.id));
  const ordered = orderedIds.filter((id) => known.has(id));
  const mentioned = new Set(ordered);
  const unmentioned = rows.map((r) => r.id).filter((id) => !mentioned.has(id));
  return [...ordered, ...unmentioned].map((id, i) => ({
    id,
    queue_rank: i + 1,
  }));
}
