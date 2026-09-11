import { describe, it, expect } from "vitest";
import {
  canSeeHackathon,
  canSeeProblemBank,
  hackathonAccess,
} from "@/lib/hackathon/access";

describe("hackathonAccess", () => {
  it("locks out anyone who is not in an invited cohort", () => {
    expect(
      hackathonAccess({
        inInvitedCohort: false,
        hasResponded: false,
        realRole: "member",
      }),
    ).toBe("locked");
  });

  it("stays locked even if a response somehow exists", () => {
    // A member whose cohort's access was turned off after they answered
    // loses the bank, not just the form.
    expect(
      hackathonAccess({
        inInvitedCohort: false,
        hasResponded: true,
        realRole: "member",
      }),
    ).toBe("locked");
  });

  it("shows an invited member the survey until they answer", () => {
    expect(
      hackathonAccess({
        inInvitedCohort: true,
        hasResponded: false,
        realRole: "member",
      }),
    ).toBe("survey");
  });

  it("opens the bank once an invited member has answered", () => {
    expect(
      hackathonAccess({
        inInvitedCohort: true,
        hasResponded: true,
        realRole: "member",
      }),
    ).toBe("open");
  });

  it("opens everything for a super admin in no cohort at all", () => {
    // The real situation: the person running the hackathon is not enrolled on
    // Cohort 1A or 1B, and would otherwise be the one person unable to watch
    // responses arrive.
    expect(
      hackathonAccess({
        inInvitedCohort: false,
        hasResponded: false,
        realRole: "super_admin",
      }),
    ).toBe("open");
  });

  it("judges the admin arm on the real role, so view-as keeps the tab", () => {
    // `realRole` is what arrives here even when the effective role is
    // "member", which is the rule every mutation guard follows.
    expect(
      hackathonAccess({
        inInvitedCohort: false,
        hasResponded: false,
        realRole: "member",
      }),
    ).toBe("locked");
  });
});

describe("canSeeHackathon", () => {
  it("shows the tab in both unlocked states and neither locked one", () => {
    expect(canSeeHackathon("survey")).toBe(true);
    expect(canSeeHackathon("open")).toBe(true);
    expect(canSeeHackathon("locked")).toBe(false);
  });
});

describe("canSeeProblemBank", () => {
  it("opens only once you have put your own problem in it", () => {
    expect(canSeeProblemBank("open")).toBe(true);
    expect(canSeeProblemBank("survey")).toBe(false);
    expect(canSeeProblemBank("locked")).toBe(false);
  });
});
