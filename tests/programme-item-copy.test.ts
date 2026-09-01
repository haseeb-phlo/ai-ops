import { describe, it, expect } from "vitest";
import { parseItemCopy } from "@/lib/programme/item-copy";
import { buildTrackItems } from "@/lib/programme/track-spec";

describe("parseItemCopy", () => {
  it("returns nothing for an empty description", () => {
    expect(parseItemCopy(null)).toEqual([]);
    expect(parseItemCopy("")).toEqual([]);
    expect(parseItemCopy("   \n  ")).toEqual([]);
  });

  it("renders a one-line description as a single paragraph", () => {
    // Every description was this shape before tasks grew steps, and they must
    // keep rendering exactly as they did.
    expect(parseItemCopy("Apply the day's technique to something.")).toEqual([
      { kind: "paragraph", text: "Apply the day's technique to something." },
    ]);
  });

  it("makes each line its own paragraph", () => {
    expect(parseItemCopy("First line.\nSecond line.")).toEqual([
      { kind: "paragraph", text: "First line." },
      { kind: "paragraph", text: "Second line." },
    ]);
  });

  it("groups consecutive bullet lines into one list", () => {
    expect(parseItemCopy("Pick three:\n- one\n- two\n- three\nThen predict.")).toEqual([
      { kind: "paragraph", text: "Pick three:" },
      { kind: "list", items: ["one", "two", "three"] },
      { kind: "paragraph", text: "Then predict." },
    ]);
  });

  it("accepts the bullet characters a paste from a doc brings with it", () => {
    expect(parseItemCopy("• one\n* two\n- three")).toEqual([
      { kind: "list", items: ["one", "two", "three"] },
    ]);
  });

  it("treats blank lines as separators, not as blocks", () => {
    // Copy pasted with double spacing must render the same as copy without:
    // the card owns the vertical rhythm.
    expect(parseItemCopy("One.\n\n\nTwo.")).toEqual([
      { kind: "paragraph", text: "One." },
      { kind: "paragraph", text: "Two." },
    ]);
  });

  it("starts a new list when a paragraph interrupts one", () => {
    expect(parseItemCopy("- a\nmiddle\n- b")).toEqual([
      { kind: "list", items: ["a"] },
      { kind: "paragraph", text: "middle" },
      { kind: "list", items: ["b"] },
    ]);
  });

  it("ignores a stray dash with nothing after it", () => {
    expect(parseItemCopy("Line one.\n-\nLine two.")).toEqual([
      { kind: "paragraph", text: "Line one." },
      { kind: "paragraph", text: "Line two." },
    ]);
  });

  it("handles Windows line endings", () => {
    expect(parseItemCopy("One.\r\n- two")).toEqual([
      { kind: "paragraph", text: "One." },
      { kind: "list", items: ["two"] },
    ]);
  });
});

describe("the track's own copy", () => {
  const tasks = buildTrackItems().filter((i) => i.type === "use_example");

  it("parses every task description into at least one block", () => {
    for (const task of tasks) {
      expect(parseItemCopy(task.description ?? null).length).toBeGreaterThan(0);
    }
  });

  it("gives day 2 its lead-in, its three bullets and its instructions", () => {
    const day2 = tasks.find((t) => t.dayIndex === 2)!;
    const blocks = parseItemCopy(day2.description ?? null);
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      text: "Pick three jobs from this week:",
    });
    expect(blocks[1].kind).toBe("list");
    expect(blocks[1].kind === "list" && blocks[1].items).toHaveLength(3);
    // The link ask is the last thing the member reads, next to the field that
    // takes it.
    expect(blocks.at(-1)).toEqual({
      kind: "paragraph",
      text: "Submit the link to one of these, preferably the one with the output that surprised you the most.",
    });
  });
});
