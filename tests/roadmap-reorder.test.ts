import { describe, it, expect } from "vitest";
import {
  renumberQueue,
  type QueuedRow,
} from "@/app/(protected)/roadmap/reorder";

describe("renumberQueue", () => {
  it("renumbers the queue 1..n in the client's order", () => {
    const rows: QueuedRow[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(renumberQueue(rows, ["c", "a", "b"])).toEqual([
      { id: "c", queue_rank: 1 },
      { id: "a", queue_rank: 2 },
      { id: "b", queue_rank: 3 },
    ]);
  });

  it("drops ids the server doesn't know about (stale client state)", () => {
    const rows: QueuedRow[] = [{ id: "a" }, { id: "b" }];
    // "ghost" was dequeued by someone else mid-drag.
    expect(renumberQueue(rows, ["b", "ghost", "a"])).toEqual([
      { id: "b", queue_rank: 1 },
      { id: "a", queue_rank: 2 },
    ]);
  });

  it("appends rows the client didn't mention, keeping their server order", () => {
    // "x" and "y" were queued concurrently; the client only reordered a/b.
    const rows: QueuedRow[] = [
      { id: "a" },
      { id: "x" },
      { id: "b" },
      { id: "y" },
    ];
    expect(renumberQueue(rows, ["b", "a"])).toEqual([
      { id: "b", queue_rank: 1 },
      { id: "a", queue_rank: 2 },
      { id: "x", queue_rank: 3 },
      { id: "y", queue_rank: 4 },
    ]);
  });

  it("assigns dense ranks even when the current order was unranked", () => {
    // Rows queued via "Add to queue" before any manual ordering may share
    // rank gaps or nulls server-side; the helper only cares about order.
    const rows: QueuedRow[] = [{ id: "a" }, { id: "b" }];
    expect(renumberQueue(rows, ["a", "b"])).toEqual([
      { id: "a", queue_rank: 1 },
      { id: "b", queue_rank: 2 },
    ]);
  });
});
