import { describe, it, expect } from "vitest";
import { canUserEditWorkflow } from "@/app/(protected)/workflows/[id]/permissions";

const baseUser = {
  id: "user-1",
  role: "member",
  team: null as string | null,
  email: "alice@wearephlo.com",
  displayName: "Alice Anderson",
  peopleDisplayName: "Alice Anderson",
};

const baseWorkflow = {
  created_by: null as string | null,
  owner_names: null as string[] | null,
  team: null as string | null,
};

describe("canUserEditWorkflow", () => {
  it("allows super_admin regardless of team or ownership", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, role: "super_admin" },
        { ...baseWorkflow, team: "Clinical" },
      ),
    ).toBe(true);
  });

  it("allows the original creator", () => {
    expect(
      canUserEditWorkflow(baseUser, { ...baseWorkflow, created_by: "user-1" }),
    ).toBe(true);
  });

  it("allows a same-team member even without owner_names match", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, team: "Clinical" },
        { ...baseWorkflow, team: "Clinical" },
      ),
    ).toBe(true);
  });

  it("same-team check is case-insensitive and trimmed", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, team: " clinical " },
        { ...baseWorkflow, team: "Clinical" },
      ),
    ).toBe(true);
  });

  it("does NOT match null team to null team", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, team: null },
        { ...baseWorkflow, team: null },
      ),
    ).toBe(false);
  });

  it("does NOT match cross-team users", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, team: "Executive" },
        { ...baseWorkflow, team: "Clinical" },
      ),
    ).toBe(false);
  });

  it("allows a user named in owner_names by display name", () => {
    expect(
      canUserEditWorkflow(baseUser, {
        ...baseWorkflow,
        owner_names: ["Alice Anderson"],
      }),
    ).toBe(true);
  });

  it("allows a user named in owner_names by directory name when profile drifted", () => {
    expect(
      canUserEditWorkflow(
        { ...baseUser, displayName: "Alice", peopleDisplayName: "Alice Anderson" },
        { ...baseWorkflow, owner_names: ["Alice Anderson"] },
      ),
    ).toBe(true);
  });

  it("owner_names match is case-insensitive and trimmed", () => {
    expect(
      canUserEditWorkflow(baseUser, {
        ...baseWorkflow,
        owner_names: ["  alice anderson  "],
      }),
    ).toBe(true);
  });

  it("rejects an unrelated user", () => {
    expect(
      canUserEditWorkflow(baseUser, {
        ...baseWorkflow,
        created_by: "someone-else",
        owner_names: ["Bob Brown"],
        team: "Clinical",
      }),
    ).toBe(false);
  });

  it("does not match owner_names by partial first-name overlap", () => {
    // Alice should not gain edit rights on a workflow owned by "Alice Smith"
    // just because they share a first name.
    expect(
      canUserEditWorkflow(
        { ...baseUser, displayName: "Alice", peopleDisplayName: "Alice Anderson" },
        { ...baseWorkflow, owner_names: ["Alice Smith"] },
      ),
    ).toBe(false);
  });
});
