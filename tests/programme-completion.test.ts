import { describe, it, expect } from "vitest";
import {
  canViewCertificate,
  certificateState,
  decideCompletion,
} from "@/lib/programme/completion";
import { computeGates, type GateInput } from "@/lib/programme/gates";

const passing: GateInput = {
  contentItemIds: ["a"],
  completedItemIds: new Set(["a"]),
  sessionItemIds: ["s"],
  satisfiedSessionItemIds: new Set(["s"]),
  approvedSignedExamples: 5,
  capstoneCredits: 0,
  bestSummativeQuizScore: 8,
  summativeQuizPassMark: 8,
  hasPostResponse: true,
};

describe("decideCompletion", () => {
  it("completes when all four gates pass for the first time", () => {
    expect(
      decideCompletion({ gates: computeGates(passing), completedAt: null }),
    ).toEqual({ action: "complete" });
  });

  it("does nothing while a gate is outstanding", () => {
    expect(
      decideCompletion({
        gates: computeGates({ ...passing, hasPostResponse: false }),
        completedAt: null,
      }),
    ).toEqual({ action: "none" });
  });

  it("does not re-complete someone already completed", () => {
    // The Slack congratulation fires on this decision, so a second "complete"
    // would announce the same person twice.
    expect(
      decideCompletion({
        gates: computeGates(passing),
        completedAt: "2026-09-18T10:00:00Z",
      }),
    ).toEqual({ action: "already" });
  });

  it("NEVER un-completes when a gate later stops passing", () => {
    // Gates are computed from live data. An admin correcting an attendance
    // mark weeks later must not revoke a certificate that has already been
    // earned and announced.
    expect(
      decideCompletion({
        gates: computeGates({ ...passing, satisfiedSessionItemIds: new Set() }),
        completedAt: "2026-09-18T10:00:00Z",
      }),
    ).toEqual({ action: "already" });
  });
});



describe("certificateState", () => {
  const base = {
    completedAt: null as string | null,
    certificateIssuedAt: null as string | null,
    certificateDeclinedAt: null as string | null,
  };
  const T = "2026-09-18T10:00:00Z";

  it("is not_earned until every gate is met", () => {
    expect(certificateState(base)).toBe("not_earned");
  });

  it("waits for an admin once the gates are met", () => {
    // The review queue is the point: gates can be technically satisfied by
    // work that is not what the programme intended.
    expect(certificateState({ ...base, completedAt: T })).toBe(
      "awaiting_approval",
    );
  });

  it("is issued once an admin approves", () => {
    expect(
      certificateState({ ...base, completedAt: T, certificateIssuedAt: T }),
    ).toBe("issued");
  });

  it("is declined when an admin sends it back", () => {
    expect(
      certificateState({ ...base, completedAt: T, certificateDeclinedAt: T }),
    ).toBe("declined");
  });

  it("treats issuing as final, even over a previous decline", () => {
    expect(
      certificateState({
        completedAt: T,
        certificateIssuedAt: T,
        certificateDeclinedAt: T,
      }),
    ).toBe("issued");
  });

  it("shows the certificate only once issued", () => {
    expect(canViewCertificate(null)).toBe(false);
    expect(canViewCertificate(T)).toBe(true);
  });
});
