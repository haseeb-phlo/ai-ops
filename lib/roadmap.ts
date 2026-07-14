/**
 * Shared roadmap vocabulary and ordering, importable from any execution
 * context (server pages, client board, Server Actions). Server-only queue
 * helpers live in lib/roadmap-server.ts.
 */

/**
 * The suggestion statuses that appear on the roadmap board, in lane order.
 * Lane keys ARE status values - one vocabulary for the board columns, the
 * page queries, and the lane-move action schemas.
 */
export const ROADMAP_STATUSES = [
  "accepted",
  "queued",
  "in_progress",
  "shipped",
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export type QueueOrderable = {
  queue_rank: number | null;
  created_at: string;
};

/**
 * Canonical Queued-lane order: explicit priority first (rank asc), rows
 * never manually ranked after those, oldest first (FIFO). Every surface
 * that renders the queue (the board, the dashboard snapshot) sorts with
 * this, so ordinals always agree across pages.
 */
export function compareQueueOrder(a: QueueOrderable, b: QueueOrderable): number {
  if (a.queue_rank !== null && b.queue_rank !== null) {
    return a.queue_rank - b.queue_rank;
  }
  if (a.queue_rank !== null) return -1;
  if (b.queue_rank !== null) return 1;
  return a.created_at.localeCompare(b.created_at);
}
