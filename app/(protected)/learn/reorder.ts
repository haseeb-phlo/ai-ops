// Pure helper for drag-to-reorder, kept out of actions.ts because that file
// is "use server" (every export there must be an async Server Action).
//
// Strategy: a reorder only ever touches one topic/subtopic bucket. We keep
// the exact multiset of `position` values that bucket's videos already hold
// and re-deal them to the videos in their new visual order. Because we reuse
// the same slots, positions in other buckets are never disturbed and we
// can't collide with rows we didn't touch - even though positions are global
// and interleaved across topics.

export type PositionedVideo = { id: string; position: number };

/**
 * Given the bucket's current rows and the desired order of (a subset of)
 * their ids, return the position to write for each id. Ids not present in
 * `rows` are dropped (stale client state); rows whose id isn't in
 * `orderedIds` keep contributing their slot but aren't reassigned.
 */
export function redealBucketPositions(
  rows: PositionedVideo[],
  orderedIds: string[],
): { id: string; position: number }[] {
  const known = new Set(rows.map((r) => r.id));
  const ids = orderedIds.filter((id) => known.has(id));
  const slots = rows.map((r) => r.position).sort((a, b) => a - b);
  return ids.map((id, i) => ({ id, position: slots[i] }));
}
