import { describe, it, expect } from "vitest";
import { canManageLibrary, learnAccess } from "@/lib/programme/learn-access";

describe("learnAccess", () => {
  it("shows nothing to somebody not in a cohort", () => {
    expect(learnAccess({ inCohort: false, entryGateOpen: false })).toBe("locked");
  });

  it("stays locked even if the gate flag says otherwise", () => {
    // entryGateOpen is meaningless without a cohort; the cohort check wins so
    // a stale or defaulted flag can never open the door on its own.
    expect(learnAccess({ inCohort: false, entryGateOpen: true })).toBe("locked");
  });

  it("asks for the check-in first", () => {
    expect(learnAccess({ inCohort: true, entryGateOpen: false })).toBe("checkin");
  });

  it("opens once the check-in is done", () => {
    expect(learnAccess({ inCohort: true, entryGateOpen: true })).toBe("open");
  });
});

describe("canManageLibrary", () => {
  it("is super admins only", () => {
    expect(canManageLibrary("super_admin")).toBe(true);
    expect(canManageLibrary("admin")).toBe(false);
    expect(canManageLibrary("member")).toBe(false);
  });
});
