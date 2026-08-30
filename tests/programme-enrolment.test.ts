import { describe, it, expect } from "vitest";
import {
  describeRejected,
  emptyOutcome,
  parseRoster,
  summariseOutcome,
} from "@/lib/programme/enrolment";

describe("parseRoster", () => {
  it("reads one address per line", () => {
    expect(parseRoster("a@wearephlo.com\nb@wearephlo.com").emails).toEqual([
      "a@wearephlo.com",
      "b@wearephlo.com",
    ]);
  });

  it("reads a comma separated list", () => {
    expect(parseRoster("a@wearephlo.com, b@wearephlo.com").emails).toEqual([
      "a@wearephlo.com",
      "b@wearephlo.com",
    ]);
  });

  it("reads a pasted To: field with display names", () => {
    const { emails } = parseRoster(
      "Ada Lovelace <ada@wearephlo.com>; Alan Turing <alan@wearephlo.com>",
    );
    expect(emails).toEqual(["ada@wearephlo.com", "alan@wearephlo.com"]);
  });

  it("lowercases and de-duplicates", () => {
    expect(
      parseRoster("A@wearephlo.com\na@wearephlo.com\nA@WEAREPHLO.COM").emails,
    ).toEqual(["a@wearephlo.com"]);
  });

  it("rejects addresses outside the domain rather than dropping them", () => {
    const { emails, rejected } = parseRoster(
      "someone@gmail.com\nreal@wearephlo.com",
    );
    expect(emails).toEqual(["real@wearephlo.com"]);
    expect(rejected).toEqual(["someone@gmail.com"]);
  });

  it("rejects things that are not addresses at all", () => {
    const { rejected } = parseRoster("Name\tTeam\nnotanemail");
    expect(rejected).toEqual(["Name", "Team", "notanemail"]);
  });

  it("survives an empty paste", () => {
    expect(parseRoster("   \n\n ")).toEqual({ emails: [], rejected: [] });
  });
});

describe("describeRejected", () => {
  it("says nothing when nothing was rejected", () => {
    expect(describeRejected([])).toBe("");
  });

  it("truncates a long list", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"];
    expect(describeRejected(many)).toContain("and 2 more");
  });
});

describe("summariseOutcome", () => {
  it("says so when there was nothing to do", () => {
    expect(summariseOutcome(emptyOutcome())).toBe("Nothing to do.");
  });

  it("splits immediate enrolments from those waiting on a sign-in", () => {
    const summary = summariseOutcome({
      ...emptyOutcome(),
      enrolled: ["a@wearephlo.com"],
      pending: ["b@wearephlo.com", "c@wearephlo.com"],
    });
    expect(summary).toBe("1 enrolled · 2 waiting for a first sign-in");
  });
});
