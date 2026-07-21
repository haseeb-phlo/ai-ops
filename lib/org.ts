/**
 * Hardcoded org structure used by the People → Directory tree view.
 * Editing this is the cheapest way to keep the chart accurate; a manager_id
 * column on `public.people` would be more durable but isn't worth the
 * schema overhead for a tree this shape rarely changes.
 *
 * Lookups are keyed on lowercased email so display_name stays sourced from
 * the `public.people` directory and small spelling fixes don't break the
 * tree.
 *
 * Shape is recursive: every node may own zero or more `teams` (members of
 * those `people.team` values render as chips below) and zero or more named
 * `directs` (each itself an OrgNode with its own subtree).
 */

export type OrgNode = {
  /** Lowercased email - matches `people.email`. */
  email: string;
  /**
   * `people.team` values this person owns. Members of those teams (excluding
   * this person and any named directs) render as chips below them.
   */
  teams: string[];
  /** Explicit named direct reports, each with their own subtree. */
  directs: OrgNode[];
};

export type OrgTree = {
  ceo: { email: string };
  l1: OrgNode[];
};

export const ORG_TREE: OrgTree = {
  ceo: { email: "adam.hunter@wearephlo.com" },
  l1: [
    {
      email: "alistair.murray@wearephlo.com",
      teams: [],
      directs: [
        {
          email: "dennis.ouko@wearephlo.com",
          teams: ["Governance"],
          directs: [
            {
              email: "prabhjit.jassal@wearephlo.com",
              teams: ["Patient Care", "Patient Services"],
              directs: [],
            },
            {
              email: "ting-hoi.chan@wearephlo.com",
              teams: [],
              directs: [],
            },
          ],
        },
        {
          email: "ermina.toma@wearephlo.com",
          teams: ["Fulfilment"],
          directs: [],
        },
        {
          email: "james.maciver@wearephlo.com",
          teams: ["Technology"],
          directs: [
            {
              email: "eva.luckhiram@wearephlo.com",
              teams: ["Product"],
              directs: [],
            },
            {
              email: "chris.taylor@wearephlo.com",
              teams: ["Design"],
              directs: [],
            },
          ],
        },
        {
          // Khusboo has no team or directs beneath her in the tree per
          // product direction.
          email: "khusboo.patel@wearephlo.com",
          teams: [],
          directs: [],
        },
        {
          email: "pritesh.dodhia@wearephlo.com",
          teams: ["Dispensary"],
          directs: [],
        },
        {
          email: "shamir.shah@wearephlo.com",
          teams: ["Clinical"],
          directs: [],
        },
      ],
    },
    {
      email: "assean.sheikh@wearephlo.com",
      teams: ["Digital Marketing", "Product Marketing"],
      directs: [],
    },
    {
      email: "chris.cullen@wearephlo.com",
      teams: ["Finance"],
      directs: [],
    },
    // Non-Executive Director - board-level, no teams or reports.
    {
      email: "jason.mcgibbon@wearephlo.com",
      teams: [],
      directs: [],
    },
    {
      email: "jonathan.forbes@wearephlo.com",
      teams: ["Data & Automation"],
      directs: [],
    },
    {
      email: "lauren.nicholson@wearephlo.com",
      teams: ["People"],
      directs: [],
    },
    {
      email: "neal.archbold@wearephlo.com",
      teams: [],
      directs: [
        // Named direct rather than a team chip: her `people.team` is
        // Product, which Eva owns, but she reports to Neal.
        {
          email: "sofiia.yevmenkina@wearephlo.com",
          teams: [],
          directs: [],
        },
      ],
    },
  ],
};

/**
 * Set of emails that are explicitly placed in the tree (CEO + every named
 * direct at any depth). Anyone else with a matching `team` value is
 * rendered as a team chip below their leader instead.
 */
export function namedEmails(tree: OrgTree = ORG_TREE): Set<string> {
  const set = new Set<string>();
  set.add(tree.ceo.email.toLowerCase());
  function walk(n: OrgNode) {
    set.add(n.email.toLowerCase());
    for (const d of n.directs) walk(d);
  }
  for (const l1 of tree.l1) walk(l1);
  return set;
}

/**
 * Set of `people.team` values consumed somewhere in the tree (any leader
 * owns them). Used to compute "uncovered" teams that get a separate
 * cluster at the bottom of the view.
 *
 * "Executive" is added implicitly because the CEO + L1s are all already
 * rendered as named nodes.
 */
export function coveredTeams(tree: OrgTree = ORG_TREE): Set<string> {
  const set = new Set<string>();
  function walk(n: OrgNode) {
    for (const t of n.teams) set.add(t);
    for (const d of n.directs) walk(d);
  }
  for (const l1 of tree.l1) walk(l1);
  set.add("Executive");
  return set;
}
