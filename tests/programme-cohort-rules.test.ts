import { describe, it, expect } from "vitest";
import {
  checkCanAddMember,
  isActiveCohortStatus,
} from "@/lib/programme/cohort-rules";

const base = {
  userId: "user-1",
  teamLeadUserId: "lead-1" as string | null,
  targetCohortStatus: "live",
  existingMemberships: [] as {
    cohortId: string;
    cohortName: string;
    status: string;
  }[],
};

describe("isActiveCohortStatus", () => {
  it("treats planned and live as active", () => {
    expect(isActiveCohortStatus("planned")).toBe(true);
    expect(isActiveCohortStatus("live")).toBe(true);
  });

  it("treats complete and archived as inactive", () => {
    expect(isActiveCohortStatus("complete")).toBe(false);
    expect(isActiveCohortStatus("archived")).toBe(false);
  });
});

describe("checkCanAddMember", () => {
  it("allows a straightforward add", () => {
    expect(checkCanAddMember(base)).toEqual({ ok: true });
  });

  it("allows a null team lead", () => {
    expect(checkCanAddMember({ ...base, teamLeadUserId: null })).toEqual({
      ok: true,
    });
  });

  it("rejects a member who is their own team lead", () => {
    const result = checkCanAddMember({ ...base, teamLeadUserId: "user-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("self_lead");
  });

  it("rejects a second live cohort", () => {
    const result = checkCanAddMember({
      ...base,
      existingMemberships: [
        { cohortId: "c1", cohortName: "Cohort 1", status: "live" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("already_active");
      expect(result.message).toContain("Cohort 1");
    }
  });

  it("rejects a live cohort when the user is already in a planned one", () => {
    const result = checkCanAddMember({
      ...base,
      existingMemberships: [
        { cohortId: "c2", cohortName: "Cohort 2", status: "planned" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("allows joining a live cohort while in an ARCHIVED one", () => {
    // Backfilled history must not block someone from this cohort.
    expect(
      checkCanAddMember({
        ...base,
        existingMemberships: [
          { cohortId: "c0", cohortName: "Old", status: "archived" },
          { cohortId: "cx", cohortName: "Older", status: "complete" },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("allows backfilling an ARCHIVED cohort while already in a live one", () => {
    expect(
      checkCanAddMember({
        ...base,
        targetCohortStatus: "archived",
        existingMemberships: [
          { cohortId: "c1", cohortName: "Cohort 1", status: "live" },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("checks self-lead before cohort clash, so the clearer error wins", () => {
    const result = checkCanAddMember({
      ...base,
      teamLeadUserId: "user-1",
      existingMemberships: [
        { cohortId: "c1", cohortName: "Cohort 1", status: "live" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("self_lead");
  });
});
