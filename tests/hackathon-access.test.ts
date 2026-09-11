import { describe, it, expect } from "vitest";
import {
  canSeeHackathon,
  canSeeProblemBank,
  hackathonAccess,
} from "@/lib/hackathon/access";

describe("hackathonAccess", () => {
  it("locks out anyone who is not on the guest list", () => {
    expect(
      hackathonAccess({
        isParticipant: false,
        hasResponded: false,
        realRole: "member",
      }),
    ).toBe("locked");
  });

  it("stays locked even if a response somehow exists", () => {
    // Somebody taken off the guest list after answering loses the bank, not
    // just the form.
    expect(
      hackathonAccess({
        isParticipant: false,
        hasResponded: true,
        realRole: "member",
      }),
    ).toBe("locked");
  });

  it("shows an invitee the survey until they answer", () => {
    expect(
      hackathonAccess({
        isParticipant: true,
        hasResponded: false,
        realRole: "member",
      }),
    ).toBe("survey");
  });

  it("opens the bank once an invitee has answered", () => {
    expect(
      hackathonAccess({
        isParticipant: true,
        hasResponded: true,
        realRole: "member",
      }),
    ).toBe("open");
  });

  it("opens everything for a super admin who is not on the list", () => {
    // They are the one who writes the list. An empty register would otherwise
    // lock the organiser out of the only page that can fill it.
    expect(
      hackathonAccess({
        isParticipant: false,
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
        isParticipant: false,
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
