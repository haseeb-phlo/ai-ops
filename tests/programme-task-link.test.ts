import { describe, it, expect } from "vitest";
import {
  LINKLESS_TASK_DAYS,
  TASK_LINK_KEY,
  TASK_LINK_MAX_LENGTH,
  normaliseTaskLink,
  shortenTaskLink,
  taskLinkFrom,
  taskLinksByDay,
  taskTakesLink,
} from "@/lib/programme/task-link";
import { G3_REQUIRED_CREDITS } from "@/lib/programme/gates";

describe("normaliseTaskLink", () => {
  it("keeps a full https link", () => {
    expect(normaliseTaskLink("https://claude.ai/share/abc123")).toBe(
      "https://claude.ai/share/abc123",
    );
  });

  it("trims what the paste brought with it", () => {
    expect(normaliseTaskLink("  https://claude.ai/share/abc  ")).toBe(
      "https://claude.ai/share/abc",
    );
  });

  it("adds a scheme to a bare host, because address bars hide it", () => {
    expect(normaliseTaskLink("claude.ai/share/abc")).toBe(
      "https://claude.ai/share/abc",
    );
  });

  it("leaves http alone rather than upgrading it", () => {
    // An intranet tool on plain http is a legitimate place for an output to
    // live, and silently rewriting the scheme would break the link.
    expect(normaliseTaskLink("http://wiki.internal/page")).toBe(
      "http://wiki.internal/page",
    );
  });

  it("rejects a scheme that would be dangerous to render as an anchor", () => {
    expect(normaliseTaskLink("javascript:alert(1)")).toBeNull();
    expect(normaliseTaskLink("data:text/html,<script>")).toBeNull();
  });

  it("rejects prose, empty input and anything with a space in it", () => {
    expect(normaliseTaskLink("")).toBeNull();
    expect(normaliseTaskLink("   ")).toBeNull();
    expect(normaliseTaskLink("see my drive folder")).toBeNull();
    expect(normaliseTaskLink("claude.ai/share/a b")).toBeNull();
  });

  it("rejects a hostname with no dot in it", () => {
    expect(normaliseTaskLink("localhost/thing")).toBeNull();
  });

  it("rejects anything past the column's cap", () => {
    const long = `https://claude.ai/share/${"a".repeat(TASK_LINK_MAX_LENGTH)}`;
    expect(normaliseTaskLink(long)).toBeNull();
  });
});

describe("taskLinkFrom", () => {
  it("reads the link out of a progress row's meta_json", () => {
    expect(taskLinkFrom({ [TASK_LINK_KEY]: "https://claude.ai/share/a" })).toBe(
      "https://claude.ai/share/a",
    );
  });

  it("returns null for every shape a meta_json can actually be", () => {
    expect(taskLinkFrom(null)).toBeNull();
    expect(taskLinkFrom({})).toBeNull();
    expect(taskLinkFrom({ make_up: true })).toBeNull();
    expect(taskLinkFrom({ [TASK_LINK_KEY]: "" })).toBeNull();
    expect(taskLinkFrom({ [TASK_LINK_KEY]: 42 })).toBeNull();
    expect(taskLinkFrom("not an object")).toBeNull();
  });
});

describe("shortenTaskLink", () => {
  it("drops the scheme so the row reads as a link, not a URL", () => {
    expect(shortenTaskLink("https://claude.ai/share/abc")).toBe(
      "claude.ai/share/abc",
    );
  });

  it("keeps both ends of a long link, so two are distinguishable", () => {
    const short = shortenTaskLink(
      `https://claude.ai/share/${"x".repeat(80)}tail`,
    );
    expect(short.length).toBeLessThanOrEqual(45);
    expect(short).toContain("claude.ai");
    expect(short).toContain("tail");
  });
});

describe("taskLinksByDay", () => {
  const taskItems = [
    { id: "d1", day_index: 1 },
    { id: "d2", day_index: 2 },
    { id: "d3", day_index: 3 },
  ];

  it("keys a member's links by the day they belong to", () => {
    const byDay = taskLinksByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["d1", { [TASK_LINK_KEY]: "https://claude.ai/share/one" }],
        ["d3", { [TASK_LINK_KEY]: "https://claude.ai/share/three" }],
      ]),
    });
    expect(byDay).toEqual({
      1: "https://claude.ai/share/one",
      3: "https://claude.ai/share/three",
    });
  });

  it("leaves a day out rather than filling it with an empty string", () => {
    // The admin table reads a missing day as "chase this person", so a blank
    // that looks like a link would hide exactly the thing it exists to show.
    const byDay = taskLinksByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["d1", {}],
        ["d2", { [TASK_LINK_KEY]: "" }],
        ["d3", null],
      ]),
    });
    expect(byDay).toEqual({});
  });

  it("ignores progress rows for items that are not Tasks", () => {
    const byDay = taskLinksByDay({
      taskItems,
      metaByItemId: new Map<string, unknown>([
        ["video-1", { [TASK_LINK_KEY]: "https://claude.ai/share/nope" }],
      ]),
    });
    expect(byDay).toEqual({});
  });
});

describe("taskTakesLink", () => {
  it("takes a link on every day except the listed ones", () => {
    for (let day = 1; day <= 15; day += 1) {
      expect(taskTakesLink(day), `day ${day}`).toBe(
        !LINKLESS_TASK_DAYS.has(day),
      );
    }
  });

  it("excludes day 5, whose work is settings rather than output", () => {
    expect(taskTakesLink(5)).toBe(false);
    expect(taskTakesLink(4)).toBe(true);
    expect(taskTakesLink(6)).toBe(true);
  });

  it("leaves enough linkable days to clear the Shared gate", () => {
    // The list costs G3 ceiling, not requirement - but empty enough of the
    // fifteen days out and the gate stops being reachable from Task links
    // alone, which is what the whole currency rests on. Guarded here because
    // adding a day to the set is a one-line change nowhere near gates.ts.
    const linkable = 15 - LINKLESS_TASK_DAYS.size;
    expect(linkable).toBeGreaterThanOrEqual(G3_REQUIRED_CREDITS);
  });

  it("still reads a link that was filed before a day joined the set", () => {
    // Nothing revokes it: the row stays in meta_json and keeps its credit.
    // Only the display and the admin column go. See LINKLESS_TASK_DAYS.
    const byDay = taskLinksByDay({
      taskItems: [{ id: "d5", day_index: 5 }],
      metaByItemId: new Map<string, unknown>([
        ["d5", { [TASK_LINK_KEY]: "https://claude.ai/share/old" }],
      ]),
    });
    expect(byDay).toEqual({ 5: "https://claude.ai/share/old" });
  });
});
