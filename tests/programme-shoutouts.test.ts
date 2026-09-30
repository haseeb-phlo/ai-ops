import { describe, it, expect } from "vitest";
import {
  dueShoutouts,
  SHOUTOUTS,
  shoutoutPeriodKey,
  type Shoutout,
} from "@/lib/programme/shoutouts";

const lauren = SHOUTOUTS.find(
  (s) => s.person.email === "lauren.nicholson@wearephlo.com",
)!;

describe("the table", () => {
  it("has well-formed entries", () => {
    for (const s of SHOUTOUTS) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.cohortId).toMatch(/^[0-9a-f-]{36}$/);
      expect(s.person.email).toContain("@wearephlo.com");
      expect(s.person.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("claims each entry once, per cohort and date", () => {
    const keys = SHOUTOUTS.map(shoutoutPeriodKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(shoutoutPeriodKey(lauren)).toBe(
      "shoutout:ecffee4e-ba39-4043-b5d6-4b78c8e578f8:2026-10-05",
    );
  });
});

describe("dueShoutouts", () => {
  const table: Shoutout[] = [
    { ...lauren, date: "2026-10-05" },
    { ...lauren, date: "2026-10-06", cohortId: "other" },
  ];

  it("returns only the entries dated today", () => {
    expect(dueShoutouts("2026-10-05", table)).toHaveLength(1);
    expect(dueShoutouts("2026-10-06", table)[0].cohortId).toBe("other");
  });

  it("is empty on any other day, which is the normal state", () => {
    expect(dueShoutouts("2026-10-04", table)).toEqual([]);
    expect(dueShoutouts("2027-10-05", table)).toEqual([]);
  });

  it("finds Lauren's post on Monday 5 October 2026", () => {
    expect(dueShoutouts("2026-10-05")).toContain(lauren);
  });
});

describe("Lauren's post", () => {
  it("tags her when there is a Slack id, word for word", () => {
    expect(lauren.text("<@UQXLAR82U>")).toBe(
      [
        "A special congratulations to <@UQXLAR82U> on working super hard to complete her AI training.",
        "She has been exemplary in her effort and dedication to AI and made huge strides in her AI knowledge and daily usage.",
        "Can we all put our hands together to show our appreciation? 👏👏👏.",
      ].join("\n\n"),
    );
  });

  it("names her when there is not", () => {
    expect(lauren.text(lauren.person.name)).toContain(
      "congratulations to Lauren Nicholson on",
    );
  });

  it("has the thread comment", () => {
    expect(lauren.threadReply).toBe(
      "Lauren did not ask for this message at all, I promise 👀.",
    );
  });
});
