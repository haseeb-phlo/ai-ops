import { describe, it, expect } from "vitest";
import { parseItemCopy } from "@/lib/programme/item-copy";
import {
  buildTrackItems,
  DAY_TOPICS,
  GENERIC_TASK,
  QUIZ_SPECS,
  SESSION_DAYS,
  SUBMISSION_SLOT_SPECS,
  SUMMATIVE_QUIZ_DAY,
} from "@/lib/programme/track-spec";

const items = buildTrackItems();
const countOf = (type: string) => items.filter((i) => i.type === type).length;

describe("Core Programme track shape", () => {
  it("produces 46 items in total", () => {
    // 1 baseline + 30 video/use_example + 3 sessions + 3 quizzes
    // + 8 submission slots + 1 post check-in.
    expect(items).toHaveLength(46);
  });

  it("has one baseline gate on day 0 and nothing else there", () => {
    const dayZero = items.filter((i) => i.dayIndex === 0);
    expect(dayZero).toHaveLength(1);
    expect(dayZero[0].type).toBe("questionnaire_baseline");
  });

  it("has a video and a use_example for each of the 15 days", () => {
    expect(countOf("video")).toBe(15);
    expect(countOf("use_example")).toBe(15);
    for (let day = 1; day <= 15; day++) {
      const forDay = items.filter((i) => i.dayIndex === day);
      expect(forDay.filter((i) => i.type === "video")).toHaveLength(1);
      expect(forDay.filter((i) => i.type === "use_example")).toHaveLength(1);
    }
  });

  it("titles each day's video with the playbook topic, in order", () => {
    const videoTitles = items
      .filter((i) => i.type === "video")
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((i) => i.title);
    expect(videoTitles).toEqual([...DAY_TOPICS]);
  });

  it("points video items at a Learn video by title and never inlines one", () => {
    for (const item of items.filter((i) => i.type === "video")) {
      expect(item.learnVideoTitle).toBeTruthy();
      expect(DAY_TOPICS).toContain(item.learnVideoTitle!);
    }
  });

  it("leaves use_example items unbound so watching cannot complete the exercise", () => {
    // Binding both halves of a day to the same Learn video would let one tick
    // on /learn satisfy both, making G1 reachable without doing any exercise.
    for (const item of items.filter((i) => i.type === "use_example")) {
      expect(item.learnVideoTitle).toBeUndefined();
    }
  });

  it("places sessions on days 3, 8 and 13", () => {
    const days = items
      .filter((i) => i.type === "session")
      .map((i) => i.dayIndex);
    expect(days).toEqual([...SESSION_DAYS]);
  });

  it("places one quiz at the end of each week", () => {
    const quizzes = items
      .filter((i) => i.type === "quiz")
      .sort((a, b) => a.dayIndex - b.dayIndex);
    expect(quizzes.map((q) => q.dayIndex)).toEqual([5, 10, 15]);
  });

  it("uses the same ten-question, 8/10 bar for all three quizzes", () => {
    // A consistent bar is simpler to explain than a sliding one, and keeps
    // "passed a Phlo AI quiz" meaning the same thing all the way through.
    // Only the final one gates completion, via G4.
    const byDay = new Map(QUIZ_SPECS.map((q) => [q.dayIndex, q]));
    for (const day of [5, 10, 15] as const) {
      expect(byDay.get(day), `day ${day}`).toMatchObject({
        questionCount: 10,
        passMark: 8,
      });
    }
    expect(QUIZ_SPECS.filter((q) => q.summative).map((q) => q.dayIndex)).toEqual([15]);
  });

  it("marks exactly one quiz summative, and it is the one G4 reads", () => {
    expect(QUIZ_SPECS.filter((q) => q.summative)).toHaveLength(1);
    expect(SUMMATIVE_QUIZ_DAY).toBe(15);
  });

  it("carries pass_mark in config so the quiz retunes without a deploy", () => {
    for (const quiz of items.filter((i) => i.type === "quiz")) {
      expect(typeof quiz.config?.pass_mark).toBe("number");
    }
  });

  it("provides five signed_example slots, a capstone, and two work samples", () => {
    const kinds = SUBMISSION_SLOT_SPECS.map((s) => s.kind);
    expect(kinds.filter((k) => k === "signed_example")).toHaveLength(5);
    expect(kinds.filter((k) => k === "capstone")).toHaveLength(1);
    expect(kinds.filter((k) => k === "work_sample_pre")).toHaveLength(1);
    expect(kinds.filter((k) => k === "work_sample_post")).toHaveLength(1);
    expect(countOf("submission_slot")).toBe(8);
  });

  it("labels the slots Example N while the kind stays signed_example", () => {
    // The label people read dropped "Signed" - it described the review rather
    // than the thing. The kind is CHECK-constrained on programme_submissions
    // and every gate, queue and export filters on it, so the mismatch is
    // deliberate and this asserts both halves of it.
    const examples = SUBMISSION_SLOT_SPECS.filter(
      (s) => s.kind === "signed_example",
    );
    expect(examples.map((s) => s.title)).toEqual([
      "Example 1",
      "Example 2",
      "Example 3",
      "Example 4",
      "Example 5",
    ]);
    for (const slot of SUBMISSION_SLOT_SPECS) {
      expect(slot.title).not.toContain("Signed example");
    }
  });

  it("keeps work samples private", () => {
    for (const slot of SUBMISSION_SLOT_SPECS) {
      if (slot.kind.startsWith("work_sample")) {
        expect(slot.visibility).toBe("private");
      }
    }
  });

  it("never opens five signed_example slots on the same day", () => {
    // RAG turns red at >=5 incomplete unlocked items, so bunching the slots
    // would put every member into red on day one. Spread is load-bearing.
    const byDay = new Map<number, number>();
    for (const slot of SUBMISSION_SLOT_SPECS) {
      if (slot.kind !== "signed_example") continue;
      byDay.set(slot.dayIndex, (byDay.get(slot.dayIndex) ?? 0) + 1);
    }
    for (const count of byDay.values()) expect(count).toBeLessThan(5);
    expect(byDay.size).toBe(5);
  });

  it("puts the post check-in on day 15", () => {
    const post = items.filter((i) => i.type === "questionnaire_post");
    expect(post).toHaveLength(1);
    expect(post[0].dayIndex).toBe(15);
  });

  it("gives every item a unique (dayIndex, sortOrder) slot", () => {
    // This pair is the seed's idempotency key AND a unique constraint. A
    // collision would make the seed silently skip a row.
    const slots = items.map((i) => `${i.dayIndex}:${i.sortOrder}`);
    expect(new Set(slots).size).toBe(items.length);
  });

  it("returns items sorted by day then sort order", () => {
    const sorted = [...items].sort(
      (a, b) => a.dayIndex - b.dayIndex || a.sortOrder - b.sortOrder,
    );
    expect(items).toEqual(sorted);
  });

  it("gives all fifteen days a written task, not the placeholder", () => {
    // GENERIC_TASK is still the fallback in code, so a day added or reordered
    // without copy silently reads "apply the day's technique" - which looks
    // finished on the page and teaches nothing. Nothing should reach it.
    for (const item of items.filter((i) => i.type === "use_example")) {
      expect(item.description, `day ${item.dayIndex}`).not.toBe(GENERIC_TASK);
    }
  });

  it("ends every task by asking for a link", () => {
    // The link is optional in code on purpose (see task-link.ts) - plenty of
    // real output is a file on a shared drive, and a required field on
    // unlinkable work buys filler links. Asking in the copy is what makes
    // filing one the norm, so the ask is checked rather than trusted.
    for (const item of items.filter((i) => i.type === "use_example")) {
      const blocks = parseItemCopy(item.description ?? null);
      const last = blocks.at(-1);
      expect(last, `day ${item.dayIndex}`).toMatchObject({
        kind: "paragraph",
      });
      // A paragraph, never a bullet: the ask is the closing line of the card,
      // and swallowed into a list it reads as one more optional step.
      expect(
        (last as { kind: "paragraph"; text: string }).text,
        `day ${item.dayIndex}`,
      ).toMatch(/^Submit /);
    }
  });

  it("writes task copy in house style", () => {
    // Same rules the quiz content is held to: hyphens rather than em dashes,
    // and no markdown, because the card renders through parseItemCopy and a
    // stray ** or # is printed literally at a member.
    for (const item of items.filter((i) => i.type === "use_example")) {
      expect(item.description, `day ${item.dayIndex}`).not.toMatch(
        /[\u2014\u2013]/,
      );
      expect(item.description, `day ${item.dayIndex}`).not.toMatch(/\*\*|^#/m);
    }
  });

  it("keeps every day within the schema's 0-15 range", () => {
    for (const item of items) {
      expect(item.dayIndex).toBeGreaterThanOrEqual(0);
      expect(item.dayIndex).toBeLessThanOrEqual(15);
    }
  });
});
