import { describe, it, expect } from "vitest";
import {
  applyStyleFixes,
  describeViolations,
  findOxfordCommas,
  findStyleViolations,
  isCleanStyle,
} from "@/lib/programme/feedback-style";

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

describe("em dashes", () => {
  it("finds both dash characters", () => {
    expect(findStyleViolations(`Good structure ${EM} tighten the brief.`)).toHaveLength(1);
    expect(findStyleViolations(`Good structure ${EN} tighten the brief.`)).toHaveLength(1);
  });

  it("replaces a spaced dash with a spaced hyphen", () => {
    expect(applyStyleFixes(`Good structure ${EM} tighten the brief.`)).toBe(
      "Good structure - tighten the brief.",
    );
  });

  it("replaces an unspaced dash too", () => {
    expect(applyStyleFixes(`context${EM}then instructions`)).toBe(
      "context - then instructions",
    );
  });
});

describe("British spelling", () => {
  it("finds and fixes the unambiguous ones", () => {
    const text = "Organize the context and analyze the behavior of the color output.";
    expect(findStyleViolations(text).filter((v) => v.rule === "americanism")).toHaveLength(4);
    expect(applyStyleFixes(text)).toBe(
      "Organise the context and analyse the behaviour of the colour output.",
    );
  });

  it("keeps the original capitalisation", () => {
    expect(applyStyleFixes("Optimize it. OPTIMIZE it.")).toBe("Optimise it. OPTIMISE it.");
  });

  it("leaves 'program' alone, because it is as likely to mean software", () => {
    const text = "The program you wrote is fine.";
    expect(findStyleViolations(text)).toHaveLength(0);
    expect(applyStyleFixes(text)).toBe(text);
  });

  it("does not fire on a substring", () => {
    expect(findStyleViolations("Recolor is not a word here")).toHaveLength(0);
  });
});

describe("Oxford comma", () => {
  it("finds one in a real list", () => {
    expect(findOxfordCommas("Add context, a role, and an example.")).toHaveLength(1);
  });

  it("removes it without touching the rest", () => {
    expect(applyStyleFixes("Add context, a role, and an example.")).toBe(
      "Add context, a role and an example.",
    );
  });

  it("leaves a clause join alone, which is the whole risk", () => {
    // Stripping this comma would be wrong: what follows "and" is a clause.
    const text = "I ran the report on Monday, checked the totals, and it worked.";
    expect(findOxfordCommas(text)).toHaveLength(0);
    expect(applyStyleFixes(text)).toBe(text);
  });

  it("handles 'or' as well as 'and'", () => {
    expect(applyStyleFixes("Name the columns, the date range, or the site.")).toBe(
      "Name the columns, the date range or the site.",
    );
  });

  it("ignores a two-item list, which has no Oxford comma to remove", () => {
    const text = "Add context and an example.";
    expect(findOxfordCommas(text)).toHaveLength(0);
  });
});

describe("slop", () => {
  it("catches the vocabulary tics", () => {
    const found = findStyleViolations("Let's delve into this robust, seamless prompt.");
    expect(found.filter((v) => v.rule === "slop").map((v) => v.found).sort()).toEqual([
      "delve",
      "robust",
      "seamless",
    ]);
  });

  it("catches the padding", () => {
    expect(
      findStyleViolations("Great job! It's worth noting that this works well.").filter(
        (v) => v.rule === "slop",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("is never auto-fixed, because the fix is different words", () => {
    const text = "Great job on this robust prompt.";
    expect(findStyleViolations(text).every((v) => v.rule !== "slop" || !v.fixable)).toBe(true);
    expect(applyStyleFixes(text)).toBe(text);
  });

  it("leaves ordinary specific feedback alone", () => {
    const text =
      "The role and context are clear. Name the report columns so it runs unchanged next week.";
    expect(isCleanStyle(text)).toBe(true);
    expect(applyStyleFixes(text)).toBe(text);
  });
});

describe("describeViolations", () => {
  it("gives the model something to act on", () => {
    const text = `Great job ${EM} organize the color list, the role, and the example.`;
    const described = describeViolations(findStyleViolations(text));
    expect(described).toContain("remove the filler");
    expect(described).toContain("great job");
    expect(described).toContain("use - rather than an em dash");
    expect(described).toContain("organize");
    expect(described).toContain("drop the comma before the final and");
  });

  it("says nothing when there is nothing to say", () => {
    expect(describeViolations([])).toBe("");
  });
});

describe("applyStyleFixes end to end", () => {
  it("clears everything mechanical in one pass", () => {
    const text = `Organize the context, the role, and the example ${EM} then reuse it.`;
    const fixed = applyStyleFixes(text);
    expect(fixed).toBe("Organise the context, the role and the example - then reuse it.");
    expect(findStyleViolations(fixed)).toHaveLength(0);
  });

  it("is idempotent", () => {
    const once = applyStyleFixes(`Analyze the color, the shape, and the size ${EM} carefully.`);
    expect(applyStyleFixes(once)).toBe(once);
  });
});
