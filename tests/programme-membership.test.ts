import { describe, it, expect } from "vitest";
import {
  pickMembership,
  rankMemberships,
  type MembershipLike,
} from "@/lib/programme/membership";

const real: MembershipLike = {
  cohortId: "real",
  joinedAt: "2026-08-21T06:48:00Z",
  status: "planned",
  isTest: false,
};

const preview: MembershipLike = {
  cohortId: "preview",
  joinedAt: "2026-08-21T17:27:00Z",
  status: "live",
  isTest: true,
};

describe("picking the membership a request is about", () => {
  it("returns undefined when the person is in no cohort", () => {
    expect(pickMembership([])).toBeUndefined();
  });

  it("honours the cohort the page says it is showing", () => {
    expect(pickMembership([real, preview], "preview")?.cohortId).toBe(
      "preview",
    );
    expect(pickMembership([real, preview], "real")?.cohortId).toBe("real");
  });

  it("prefers a real cohort over a sandbox when nothing is stated", () => {
    // The preview is both newer AND live, so "most recently joined" and
    // "active beats planned" would each pick it. Neither should.
    expect(pickMembership([real, preview])?.cohortId).toBe("real");
  });

  it("falls back to the sandbox when it is the only cohort", () => {
    expect(pickMembership([preview])?.cohortId).toBe("preview");
  });

  it("ignores a cohort id the caller is not a member of", () => {
    // The id arrives from a URL or a form field, so it is a request, not a
    // claim. Trusting it would be a way to write against somebody else's row.
    expect(pickMembership([real, preview], "someone-elses")?.cohortId).toBe(
      "real",
    );
  });

  it("prefers an active cohort, then the most recently joined", () => {
    const finished: MembershipLike = {
      cohortId: "old",
      joinedAt: "2026-05-01T00:00:00Z",
      status: "complete",
      isTest: false,
    };
    const current: MembershipLike = {
      cohortId: "current",
      joinedAt: "2026-08-01T00:00:00Z",
      status: "live",
      isTest: false,
    };
    expect(pickMembership([finished, current])?.cohortId).toBe("current");

    const alsoLive: MembershipLike = {
      cohortId: "newer",
      joinedAt: "2026-08-10T00:00:00Z",
      status: "live",
      isTest: false,
    };
    expect(pickMembership([current, alsoLive])?.cohortId).toBe("newer");
  });

  it("ranks without mutating the caller's array", () => {
    const input = [real, preview];
    rankMemberships(input);
    expect(input[0].cohortId).toBe("real");
  });

  it("puts the winner first when no real cohort exists", () => {
    // The track page reads the runners-up off the same ranking to offer
    // "switch to your other run", so the order has to be the one the winner
    // was chosen from.
    const secondPreview: MembershipLike = {
      cohortId: "preview-2",
      joinedAt: "2026-08-22T09:00:00Z",
      status: "live",
      isTest: true,
    };
    const ranked = rankMemberships([preview, secondPreview]);
    expect(ranked.map((m) => m.cohortId)).toEqual(["preview-2", "preview"]);
    expect(pickMembership([preview, secondPreview])?.cohortId).toBe(
      "preview-2",
    );
  });
});
