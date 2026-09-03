import { describe, it, expect } from "vitest";
import {
  awaitingContentCount,
  gateableContentItemIds,
  isActionable,
  isAwaitingContent,
} from "@/lib/programme/content-readiness";
import { computeGates } from "@/lib/programme/gates";

const ITEMS = [
  { id: "v1", type: "video", learn_video_id: "abc" },
  { id: "u1", type: "use_example", learn_video_id: null },
  { id: "v2", type: "video", learn_video_id: null },
  { id: "u2", type: "use_example", learn_video_id: null },
  { id: "s1", type: "session", learn_video_id: null },
  { id: "q1", type: "quiz", learn_video_id: null },
];

describe("isAwaitingContent", () => {
  it("is true for a video day with nothing recorded", () => {
    expect(
      isAwaitingContent({ id: "v2", type: "video", learn_video_id: null }),
    ).toBe(true);
  });

  it("is false once a video is bound", () => {
    expect(
      isAwaitingContent({ id: "v1", type: "video", learn_video_id: "abc" }),
    ).toBe(false);
  });

  it("never applies to a use example", () => {
    // Use examples are exercises with no video of their own, so they stay
    // actionable whatever the recording schedule is doing.
    expect(
      isAwaitingContent({ id: "u1", type: "use_example", learn_video_id: null }),
    ).toBe(false);
    expect(
      isActionable({ id: "u1", type: "use_example", learn_video_id: null }),
    ).toBe(true);
  });

  it("never applies to sessions or quizzes", () => {
    expect(
      isAwaitingContent({ id: "s1", type: "session", learn_video_id: null }),
    ).toBe(false);
    expect(
      isAwaitingContent({ id: "q1", type: "quiz", learn_video_id: null }),
    ).toBe(false);
  });
});

describe("gateableContentItemIds", () => {
  it("counts bound videos and every use example", () => {
    expect(gateableContentItemIds(ITEMS)).toEqual(["v1", "u1", "u2"]);
  });

  it("excludes unrecorded videos", () => {
    expect(gateableContentItemIds(ITEMS)).not.toContain("v2");
  });

  it("excludes sessions and quizzes, which have their own gates", () => {
    const ids = gateableContentItemIds(ITEMS);
    expect(ids).not.toContain("s1");
    expect(ids).not.toContain("q1");
  });
});

describe("G1 stays reachable while videos are still being produced", () => {
  const base = {
    completedItemIds: new Set(["v1", "u1", "u2"]),
    sessionItemIds: ["s1"],
    satisfiedSessionItemIds: new Set(["s1"]),
    approvedSignedExamples: 5,
    filedTaskLinks: 0,
    capstoneCredits: 0,
    bestSummativeQuizScore: 8,
    summativeQuizPassMark: 8,
    hasPostResponse: true,
  };

  it("passes when every recorded item is done, even with videos outstanding", () => {
    // The programme plan produces several videos DURING cohort 1, so days sit
    // unrecorded for real people.
    const gates = computeGates({
      ...base,
      contentItemIds: gateableContentItemIds(ITEMS),
    });
    expect(gates.g1.passed).toBe(true);
  });

  it("would NOT have passed if unrecorded videos were counted", () => {
    // This is the regression guard. Counting them made G1 unreachable, so
    // nobody could complete the programme and everyone drifted to red through
    // no fault of their own.
    const gates = computeGates({
      ...base,
      contentItemIds: ["v1", "u1", "v2", "u2"],
    });
    expect(gates.g1.passed).toBe(false);
  });

  it("requires the day as soon as its video lands", () => {
    const bound = ITEMS.map((i) =>
      i.id === "v2" ? { ...i, learn_video_id: "xyz" } : i,
    );
    expect(gateableContentItemIds(bound)).toContain("v2");
    const gates = computeGates({
      ...base,
      contentItemIds: gateableContentItemIds(bound),
    });
    expect(gates.g1.passed).toBe(false);
  });
});

describe("awaitingContentCount", () => {
  it("reports how many days are waiting on a recording", () => {
    expect(awaitingContentCount(ITEMS)).toBe(1);
  });
});
