import { describe, it, expect } from "vitest";
import {
  TASK_LINK_KEY,
  TASK_LINK_MAX_LENGTH,
  normaliseTaskLink,
  shortenTaskLink,
  taskLinkFrom,
} from "@/lib/programme/task-link";

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
