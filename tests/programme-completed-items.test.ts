import { describe, it, expect } from "vitest";
import { resolveCompletedItemIds } from "@/lib/programme/completed-items";

const JOINED = "2026-08-31T09:00:00+00:00";

const items = [
  { id: "day1", learn_video_id: "video-1" },
  { id: "day8", learn_video_id: "video-8" },
  { id: "use1", learn_video_id: null },
];

describe("the union", () => {
  it("counts an item the track recorded", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [{ track_item_id: "use1", status: "complete" }],
      learnCompletions: [],
      joinedAt: JOINED,
    });
    expect([...done]).toEqual(["use1"]);
  });

  it("counts a video ticked in the library during the cohort", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [],
      learnCompletions: [
        { video_id: "video-1", created_at: "2026-09-01T10:00:00+00:00" },
      ],
      joinedAt: JOINED,
    });
    expect(done.has("day1")).toBe(true);
  });

  it("does not let an un-tick in the library regress a recorded completion", () => {
    // item_progress is the durable half of the union: once the track has
    // recorded it, removing the library row cannot take it away.
    const done = resolveCompletedItemIds({
      items,
      progress: [{ track_item_id: "day1", status: "complete" }],
      learnCompletions: [],
      joinedAt: JOINED,
    });
    expect(done.has("day1")).toBe(true);
  });

  it("ignores a status that is not complete", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [{ track_item_id: "day1", status: "started" }],
      learnCompletions: [],
      joinedAt: JOINED,
    });
    expect(done.size).toBe(0);
  });
});

describe("scoping to joined_at", () => {
  // Six people had ticked videos off in the open library before the programme
  // existed; two had all twelve. Counting those would have opened their track
  // with G1 passed and three weeks of days already complete.
  const beforeTheyJoined = [
    { video_id: "video-1", created_at: "2026-06-01T10:00:00+00:00" },
    { video_id: "video-8", created_at: "2026-07-15T10:00:00+00:00" },
  ];

  it("does not pre-complete the track from library history", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [],
      learnCompletions: beforeTheyJoined,
      joinedAt: JOINED,
    });
    expect(done.size).toBe(0);
  });

  it("credits a tick made at the exact moment of joining", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [],
      learnCompletions: [{ video_id: "video-1", created_at: JOINED }],
      joinedAt: JOINED,
    });
    expect(done.has("day1")).toBe(true);
  });

  it("counts everything when there is no join date - the preview run", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [],
      learnCompletions: beforeTheyJoined,
      joinedAt: null,
    });
    expect(done.has("day1")).toBe(true);
    expect(done.has("day8")).toBe(true);
  });

  it("falls back to the durable record on an unreadable timestamp", () => {
    const done = resolveCompletedItemIds({
      items,
      progress: [{ track_item_id: "day8", status: "complete" }],
      learnCompletions: [{ video_id: "video-1", created_at: "not a date" }],
      joinedAt: JOINED,
    });
    expect(done.has("day1")).toBe(false);
    expect(done.has("day8")).toBe(true);
  });
});
