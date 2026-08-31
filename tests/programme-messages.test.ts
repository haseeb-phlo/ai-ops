import { describe, it, expect } from "vitest";
import {
  cohortCompletionText,
  cohortSummaryText,
  dayNinetyText,
  leadDigestText,
  memberReminderText,
  joinNames,
  programmeCompleteText,
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
  programmeCompleteText({
    firstName: "Sam",
    cohortName: "Cohort 1",
    trackUrl: "https://x/learn/track",
  }),
  dayNinetyText({ firstName: "Sam", scoreUrl: "https://x/learn/track/score" }),
  cohortCompletionText({
    cohortName: "Cohort 1A",
    mentions: ["<@U1>", "<@U2>", "Pat Okafor"],
  }),
];

describe("house style", () => {
  it("uses no em dashes", () => {
    // Escapes, not literals: a global dash sweep would otherwise rewrite the
    // detector and make this test pass on anything.
    for (const text of ALL) expect(text).not.toMatch(/[\u2013\u2014]/);
  });

  it("never guilt-trips", () => {
    // Someone on a late shift who missed two days does not need a robot
    // telling them off.
    for (const text of ALL) {
      expect(text.toLowerCase()).not.toContain("you are behind");
      expect(text.toLowerCase()).not.toContain("you have failed");
      expect(text.toLowerCase()).not.toContain("urgent");
    }
  });

  it("keeps exclamation marks out of anything that asks for work", () => {
    // The ban used to cover every message, which read as a blanket style rule
    // and was really a pressure rule: an exclamation mark in a nudge or a
    // sent-back note is a robot raising its voice at someone mid-shift.
    //
    // It is the opposite in the two messages that congratulate. Those are the
    // only place the programme gets to sound pleased, and holding them to the
    // register of a reminder made finishing fifteen days land flat.
    const asksForWork = ALL.filter(
      (t) => !t.includes("completed the Core Programme") && !t.includes("Congratulations"),
    );
    for (const text of asksForWork) expect(text).not.toContain("!");
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
    expect(text.split("\n")[0]).toContain(
      "one of your examples has been sent back",
    );
    // Names no reviewer: sign-off can route to a cohort default approver or an
    // AI-assisted review, neither of which is "your team lead".
    expect(text).not.toContain("team lead");
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

describe("joinNames", () => {
  it("reads naturally for one, two or three", () => {
    expect(joinNames(["Sam"])).toBe("Sam");
    expect(joinNames(["Sam", "Jo"])).toBe("Sam and Jo");
    expect(joinNames(["Sam", "Jo", "Pat"])).toBe("Sam, Jo and Pat");
  });

  it("uses no Oxford comma", () => {
    expect(joinNames(["Sam", "Jo", "Pat"])).not.toContain(", and");
  });

  it("is empty for nobody, so a caller can test before posting", () => {
    expect(joinNames([])).toBe("");
  });
});

describe("cohortCompletionText", () => {
  it("is ONE post naming everyone, not one post each", () => {
    const text = cohortCompletionText({
      cohortName: "Cohort 1A",
      mentions: ["<@U1>", "<@U2>", "<@U3>"],
    });
    expect(text).toContain("Congratulations to <@U1>, <@U2> and <@U3>.");
    expect(text).toContain("Cohort 1A");
  });

  it("keeps someone without a Slack account on the list, untagged", () => {
    // A missing Slack account is common on the frontline. It must cost the
    // ping, never the credit.
    const text = cohortCompletionText({
      cohortName: "Cohort 1A",
      mentions: ["<@U1>", "Pat Okafor"],
    });
    expect(text).toContain("<@U1> and Pat Okafor");
  });

  it("carries no praise padding", () => {
    // The tone rules ban filler. "Congratulations" is the message; the rest
    // has to say something specific or not be there.
    const text = cohortCompletionText({
      cohortName: "Cohort 1A",
      mentions: ["<@U1>"],
    });
    for (const slop of [
      "great job",
      "excellent work",
      "keep up the",
      "well done team",
      "amazing",
      "incredible",
      "journey",
      "delve",
      "leverage",
      "elevate",
      "seamless",
    ]) {
      expect(text.toLowerCase()).not.toContain(slop);
    }
  });

  it("is British English", () => {
    const text = cohortCompletionText({
      cohortName: "Cohort 1A",
      mentions: ["<@U1>"],
    });
    expect(text).toContain("Programme");
    expect(text.toLowerCase()).not.toContain("program ");
    expect(text.toLowerCase()).not.toContain("recognize");
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
