import { describe, it, expect } from "vitest";
import {
  redealBucketPositions,
  type PositionedVideo,
} from "@/app/(protected)/learn/reorder";

describe("redealBucketPositions", () => {
  it("re-deals the bucket's own slots in the new visual order", () => {
    const rows: PositionedVideo[] = [
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ];
    // Move c to the front.
    expect(redealBucketPositions(rows, ["c", "a", "b"])).toEqual([
      { id: "c", position: 1 },
      { id: "a", position: 2 },
      { id: "b", position: 3 },
    ]);
  });

  it("reuses interleaved (non-contiguous) global slots so other buckets stay put", () => {
    // ai_tools bucket holds global positions 1, 2, 4 (3 belongs to another
    // topic). After a reorder the bucket must still only ever occupy {1,2,4}.
    const rows: PositionedVideo[] = [
      { id: "x", position: 1 },
      { id: "y", position: 2 },
      { id: "z", position: 4 },
    ];
    const result = redealBucketPositions(rows, ["z", "x", "y"]);
    expect(result).toEqual([
      { id: "z", position: 1 },
      { id: "x", position: 2 },
      { id: "y", position: 4 },
    ]);
    // The multiset of slots is preserved exactly.
    expect(result.map((r) => r.position).sort((a, b) => a - b)).toEqual([
      1, 2, 4,
    ]);
  });

  it("drops ids the server doesn't know about (stale client state)", () => {
    const rows: PositionedVideo[] = [
      { id: "a", position: 5 },
      { id: "b", position: 9 },
    ];
    // "ghost" was deleted by someone else mid-drag.
    const result = redealBucketPositions(rows, ["b", "ghost", "a"]);
    expect(result).toEqual([
      { id: "b", position: 5 },
      { id: "a", position: 9 },
    ]);
  });

  it("is a no-op (identity) when the order is unchanged", () => {
    const rows: PositionedVideo[] = [
      { id: "a", position: 10 },
      { id: "b", position: 20 },
    ];
    expect(redealBucketPositions(rows, ["a", "b"])).toEqual([
      { id: "a", position: 10 },
      { id: "b", position: 20 },
    ]);
  });
});
