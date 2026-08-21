/**
 * Who signs off whose work.
 *
 * `people` has no manager column, so `ORG_TREE` in lib/org.ts is the only
 * machine-readable reporting line in the repo. This walks it to default a
 * cohort member's `team_lead_user_id` at enrolment.
 *
 * It is a DEFAULT, not the truth: an admin can override it on the roster
 * before the cohort starts. Getting it roughly right beats leaving everyone
 * unassigned, because a member with no lead has no sign-off route and can
 * never pass G3.
 *
 * Lives here rather than in the join action because a `"use server"` module
 * may only export async functions - the same split as workflows' permissions.ts.
 */

import { ORG_TREE, type OrgNode, type OrgTree } from "@/lib/org";

/**
 * The nearest named leader above someone: whoever lists them as a direct
 * report, or failing that whoever owns their team. Null when the tree has no
 * answer - the CEO, or someone on a team nobody owns.
 */
export function findLeadEmail(
  memberEmail: string,
  memberTeam: string | null,
  tree: OrgTree = ORG_TREE,
): string | null {
  const email = memberEmail.trim().toLowerCase();
  if (!email) return null;

  // The CEO reports to nobody.
  if (tree.ceo.email.toLowerCase() === email) return null;

  // Named in the tree: their lead is whoever holds them.
  function findParent(node: OrgNode, parentEmail: string): string | null {
    if (node.email.toLowerCase() === email) return parentEmail;
    for (const direct of node.directs) {
      const found = findParent(direct, node.email);
      if (found !== null) return found;
    }
    return null;
  }
  for (const l1 of tree.l1) {
    const found = findParent(l1, tree.ceo.email);
    if (found !== null) return found.toLowerCase();
  }

  // Otherwise: whoever owns their team. Depth-first, so the most specific
  // owner wins over an ancestor who also happens to list the team.
  if (memberTeam) {
    // Captured so the narrowing survives into the closure - TypeScript can't
    // know findTeamOwner runs synchronously.
    const team = memberTeam;
    let owner: string | null = null;
    function findTeamOwner(node: OrgNode): void {
      for (const direct of node.directs) findTeamOwner(direct);
      if (owner === null && node.teams.includes(team)) {
        owner = node.email;
      }
    }
    for (const l1 of tree.l1) findTeamOwner(l1);
    if (owner !== null) return (owner as string).toLowerCase();
  }

  return null;
}
