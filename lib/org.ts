/**
 * Hardcoded org structure used by the People → Org view. Editing this is
 * the cheapest way to keep the org chart accurate; a manager_id column on
 * `public.people` would be more durable but isn't worth the schema overhead
 * for a tree this shape rarely changes.
 *
 * Lookups are keyed on lowercased email so display_name stays sourced from
 * the `public.people` directory and small spelling differences (e.g.
 * Khushboo vs Khusboo) don't break the tree.
 */

export type OrgLeaf = {
  /** Lowercased email — matches `people.email`. */
  email: string;
  /**
   * The `people.team` value the leader owns, if any. Members of that team
   * (excluding the leader themself) render below them in the tree.
   * `null` means the leader has no team beneath them in the tree.
   */
  team: string | null;
};

export type OrgL1 = OrgLeaf & {
  /**
   * For Alistair only: explicit L2 directs. Empty for L1s who own a flat
   * team directly (their team comes from the `team` field instead).
   */
  directs: OrgLeaf[];
};

export type OrgTree = {
  ceo: { email: string };
  l1: OrgL1[];
};

export const ORG_TREE: OrgTree = {
  ceo: { email: "adam.hunter@wearephlo.com" },
  l1: [
    {
      email: "alistair.murray@wearephlo.com",
      // Alistair's "team" is the named L2s below — not a public.team value.
      team: null,
      directs: [
        { email: "dennis.ouko@wearephlo.com", team: "Governance" },
        { email: "ermina.toma@wearephlo.com", team: "Fulfilment" },
        { email: "james.maciver@wearephlo.com", team: "Technology" },
        // Khushboo has no team beneath her per product direction.
        { email: "khusboo.patel@wearephlo.com", team: null },
        { email: "pritesh.dodhia@wearephlo.com", team: "Dispensary" },
        { email: "shamir.shah@wearephlo.com", team: "Clinical" },
      ],
    },
    {
      email: "assean.sheikh@wearephlo.com",
      team: "Digital Marketing",
      directs: [],
    },
    {
      email: "chris.cullen@wearephlo.com",
      team: "Finance",
      directs: [],
    },
    {
      email: "jonathan.forbes@wearephlo.com",
      team: "Data & Automation",
      directs: [],
    },
    {
      email: "lauren.nicholson@wearephlo.com",
      team: "People",
      directs: [],
    },
    // Neal has nobody below him.
    {
      email: "neal.archbold@wearephlo.com",
      team: null,
      directs: [],
    },
  ],
};

/**
 * Set of emails that are explicitly placed in the tree as named leaders or
 * L2s. Anyone else with a matching `team` value is rendered as a team chip
 * below their leader.
 */
export function namedEmails(tree: OrgTree = ORG_TREE): Set<string> {
  const set = new Set<string>();
  set.add(tree.ceo.email.toLowerCase());
  for (const l1 of tree.l1) {
    set.add(l1.email.toLowerCase());
    for (const d of l1.directs) {
      set.add(d.email.toLowerCase());
    }
  }
  return set;
}

/**
 * Set of `people.team` values consumed by the tree (a leader is rendered
 * as the head of these). Used to compute "uncovered" teams that get a
 * separate cluster at the bottom.
 */
export function coveredTeams(tree: OrgTree = ORG_TREE): Set<string> {
  const set = new Set<string>();
  for (const l1 of tree.l1) {
    if (l1.team) set.add(l1.team);
    for (const d of l1.directs) {
      if (d.team) set.add(d.team);
    }
  }
  // The Executive team is implicitly covered (Adam + L1s + James already
  // appear as named nodes). Anyone else in Executive would still show as
  // a top-row chip if we don't suppress it; treat it as covered.
  set.add("Executive");
  return set;
}
