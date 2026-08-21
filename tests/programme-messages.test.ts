import { describe, it, expect } from "vitest";
import {
  certificateAnnouncementText,
  certificateIssuedText,
  cohortSummaryText,
  dayNinetyText,
  leadDigestText,
  memberReminderText,
  rejectionText,
} from "@/lib/programme/messages";

/**
 * These land in people's DMs during a mandatory programme, so the tests are
 * as much about tone as about content. A reminder that reads as a telling-off
 * makes people disengage, and nothing else in the system would catch that.
 */

const ALL = [
  memberReminderText({
    firstName: "Sam",
    outstandingCount: 3,
    openDays: [4, 5],
    trackUrl: "https://x/learn/track",
    hasRejection: false,
  }),
  leadDigestText({
    firstName: "Alex",
    members: [
      { name: "Sam", rag: "red" },
      { name: "Jo", rag: "green" },
    ],
    pendingSignOffs: 2,
    boardUrl: "https://x/learn/leads",
  }),
  cohortSummaryText({
    cohortName: "Cohort 1",
    weekNumber: 2,
    completedNames: ["Jo"],
    onTrack: 8,
    total: 10,
  }),
  rejectionText({
    firstName: "Sam",
    itemTitle: "Signed example 2",
    leadName: "Alex",
    comment: "Add the actual prompt.",
    trackUrl: "https://x/learn/track",
  }),
  certificateIssuedText({
    firstName: "Sam",
    cohortName: "Cohort 1",
    certificateUrl: "https://x/learn/track/certificate",
  }),
  dayNinetyText({ firstName: "Sam", scoreUrl: "https://x/learn/track/score" }),
];

describe("house style", () => {
  it("uses no em dashes", () => {
    for (const text of ALL) expect(text).not.toMatch(/[—–]/);
  });

  it("never guilt-trips", () => {
    // Someone on a late shift who missed two days does not need a robot
    // telling them off.
    for (const text of ALL) {
      expect(text.toLowerCase()).not.toContain("you are behind");
      expect(text.toLowerCase()).not.toContain("you have failed");
      expect(text.toLowerCase()).not.toContain("urgent");
      expect(text).not.toContain("!");
    }
  });

  it("gives exactly one link per message", () => {
    for (const text of ALL) {
      const links = text.match(/https?:\/\/\S+/g) ?? [];
      expect(links.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("memberReminderText", () => {
  it("names what is open and roughly how long it takes", () => {
    const text = memberReminderText({
      firstName: "Sam",
      outstandingCount: 3,
      openDays: [4, 5],
      trackUrl: "https://x",
      hasRejection: false,
    });
    expect(text).toContain("Sam");
    expect(text).toContain("3 things open");
    expect(text).toContain("days 4, 5");
    expect(text).toContain("ten minutes");
  });

  it("leads with the rejection when there is one, since it blocks them", () => {
    const text = memberReminderText({
      firstName: "Sam",
      outstandingCount: 1,
      openDays: [],
      trackUrl: "https://x",
      hasRejection: true,
    });
    expect(text.split("\n")[0]).toContain("sent one of your examples back");
  });

  it("gets the singular right", () => {
    const text = memberReminderText({
      firstName: "Sam",
      outstandingCount: 1,
      openDays: [4],
      trackUrl: "https://x",
      hasRejection: false,
    });
    expect(text).toContain("1 thing open");
    expect(text).toContain("day 4");
  });

  it("does not list a dozen days", () => {
    const text = memberReminderText({
      firstName: "Sam",
      outstandingCount: 12,
      openDays: [1, 2, 3, 4, 5, 6, 7, 8],
      trackUrl: "https://x",
      hasRejection: false,
    });
    expect(text).toContain("days 1, 2, 3, 4)");
  });
});

describe("leadDigestText", () => {
  it("leads with the sign-offs, which are the actionable part", () => {
    const text = leadDigestText({
      firstName: "Alex",
      members: [{ name: "Sam", rag: "red" }],
      pendingSignOffs: 2,
      boardUrl: "https://x",
    });
    expect(text).toContain("2 submissions waiting");
    expect(text).toContain("Worth a word with: Sam");
  });

  it("says so plainly when there is nothing to do", () => {
    const text = leadDigestText({
      firstName: "Alex",
      members: [{ name: "Jo", rag: "green" }],
      pendingSignOffs: 0,
      boardUrl: "https://x",
    });
    expect(text).toContain("nothing waiting on you");
  });

  it("mentions slipping members only when nobody is behind", () => {
    const text = leadDigestText({
      firstName: "Alex",
      members: [{ name: "Jo", rag: "amber" }],
      pendingSignOffs: 0,
      boardUrl: "https://x",
    });
    expect(text).toContain("Slipping a little: Jo");
  });
});

describe("certificateAnnouncementText", () => {
  it("reads naturally for one person", () => {
    expect(certificateAnnouncementText(["Sam"])).toBe(
      "Sam has completed the Core Programme.",
    );
  });

  it("batches same-day completions into one message", () => {
    // Three separate posts in a channel is spam; one is an announcement.
    expect(certificateAnnouncementText(["Sam", "Jo", "Pat"])).toBe(
      "Sam, Jo and Pat have completed the Core Programme.",
    );
  });

  it("uses no Oxford comma", () => {
    expect(certificateAnnouncementText(["Sam", "Jo", "Pat"])).not.toContain(
      ", and",
    );
  });
});

describe("rejectionText", () => {
  it("quotes the lead's comment, since that is the actionable part", () => {
    const text = rejectionText({
      firstName: "Sam",
      itemTitle: "Signed example 2",
      leadName: "Alex",
      comment: "Add the actual prompt.",
      trackUrl: "https://x",
    });
    expect(text).toContain('"Add the actual prompt."');
    expect(text).toContain("Alex");
    expect(text).toContain("whenever you are ready");
  });
});

describe("dayNinetyText", () => {
  it("sets the expectation that it is quick and pre-filled", () => {
    const text = dayNinetyText({ firstName: "Sam", scoreUrl: "https://x" });
    expect(text).toContain("Sixty seconds");
    expect(text).toContain("pre-filled");
  });
});
