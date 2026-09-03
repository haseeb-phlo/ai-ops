import { describe, it, expect } from "vitest";
import { findLeadEmail } from "@/lib/programme/org-lead";
import { ORG_TREE } from "@/lib/org";

/**
 * These assert against the REAL org tree, not a fixture. That's deliberate:
 * the value of this function is whether it routes actual Phlo people to
 * actual Phlo leads, and a fixture would happily pass while the real tree
 * left half the company unassigned.
 */
describe("findLeadEmail", () => {
  it("routes an L1 to the CEO", () => {
    expect(findLeadEmail("chris.cullen@wearephlo.com", "Finance")).toBe(
      ORG_TREE.ceo.email.toLowerCase(),
    );
  });

  it("routes a named direct to the person who holds them", () => {
    // eva.luckhiram sits under james.maciver in the tree.
    expect(findLeadEmail("eva.luckhiram@wearephlo.com", "Product")).toBe(
      "james.maciver@wearephlo.com",
    );
  });

  it("routes an unnamed person to whoever owns their team", () => {
    // Nobody named in the tree, but Dispensary is owned by pritesh.dodhia.
    expect(findLeadEmail("someone.new@wearephlo.com", "Dispensary")).toBe(
      "pritesh.dodhia@wearephlo.com",
    );
  });

  it("gives the CEO no lead", () => {
    expect(findLeadEmail(ORG_TREE.ceo.email, null)).toBeNull();
  });

  it("returns null for a team nobody owns, rather than guessing", () => {
    // Better to leave it unassigned for an admin to fix than to invent a
    // sign-off route to the wrong person.
    expect(findLeadEmail("someone@wearephlo.com", "Team That Does Not Exist")).toBeNull();
  });

  it("returns null when there's no team and no tree entry", () => {
    expect(findLeadEmail("someone@wearephlo.com", null)).toBeNull();
  });

  it("is case- and whitespace-insensitive on the email", () => {
    expect(findLeadEmail("  Eva.Luckhiram@WearePhlo.com  ", "Product")).toBe(
      "james.maciver@wearephlo.com",
    );
  });

  it("never routes someone to themselves", () => {
    // Self-lead is rejected by a CHECK constraint, so producing one here would
    // make enrolment fail outright.
    const owners = ["pritesh.dodhia@wearephlo.com", "shamir.shah@wearephlo.com"];
    for (const owner of owners) {
      expect(findLeadEmail(owner, "Dispensary")).not.toBe(owner);
      expect(findLeadEmail(owner, "Clinical")).not.toBe(owner);
    }
  });

  it("resolves a lead for every team in the people directory's tree", () => {
    // A team with no owner means everyone on it enrols with no sign-off
    // route, so nothing they submit can be approved - worth knowing before a
    // cohort starts, not after.
    const teams = new Set<string>();
    function walk(node: { teams: string[]; directs: { teams: string[]; directs: never[] }[] }) {
      for (const t of node.teams) teams.add(t);
      for (const d of node.directs) walk(d as never);
    }
    for (const l1 of ORG_TREE.l1) walk(l1 as never);
    for (const team of teams) {
      expect(
        findLeadEmail("nobody.special@wearephlo.com", team),
        `no lead for team "${team}"`,
      ).not.toBeNull();
    }
  });
});
