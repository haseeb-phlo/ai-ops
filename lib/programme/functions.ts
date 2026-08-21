/**
 * Function grouping for reporting.
 *
 * Teams are the unit people belong to; functions are the unit the exec reads.
 * Reporting fifteen teams of two makes every number noise, so teams roll up
 * into six functions.
 *
 * This is CONFIG, deliberately, not a hardcoded CASE in a query. Phlo
 * reorganises, teams get renamed and split, and when that happens the fix
 * should be one edit here rather than a hunt through SQL. It is also the only
 * place that decides what "Clinical & Patient Ops" means, so two reports
 * cannot disagree about it.
 *
 * Groupings come from the programme plan. Any team not listed falls into
 * "Unassigned" rather than being silently dropped, because a team missing from
 * a report is far harder to notice than one sitting in an obviously wrong
 * bucket.
 */

export const FUNCTION_GROUPS = {
  Executive: ["Executive"],
  "Clinical & Patient Ops": [
    "Clinical",
    "Dispensary",
    "Patient Care",
    "Patient Services",
    "Fulfilment",
    "Clinical Product",
  ],
  Marketing: ["Digital Marketing", "Product Marketing"],
  "Product & Design": ["Product", "Design"],
  "Technology & Data": ["Technology", "Data & Automation"],
  "Finance, People & Governance": ["Finance", "People", "Governance"],
} as const satisfies Record<string, readonly string[]>;

export type FunctionName = keyof typeof FUNCTION_GROUPS;

/** Where a team that nobody has grouped ends up. Visible, not dropped. */
export const UNASSIGNED_FUNCTION = "Unassigned";

/** Render order. Deliberate: the largest function first, exec last. */
export const FUNCTION_ORDER: readonly string[] = [
  "Clinical & Patient Ops",
  "Technology & Data",
  "Marketing",
  "Product & Design",
  "Finance, People & Governance",
  "Executive",
  UNASSIGNED_FUNCTION,
];

const TEAM_TO_FUNCTION: ReadonlyMap<string, string> = new Map(
  Object.entries(FUNCTION_GROUPS).flatMap(([fn, teams]) =>
    teams.map((team) => [team.toLowerCase(), fn] as const),
  ),
);

export function functionForTeam(team: string | null | undefined): string {
  if (!team) return UNASSIGNED_FUNCTION;
  return TEAM_TO_FUNCTION.get(team.trim().toLowerCase()) ?? UNASSIGNED_FUNCTION;
}

/** Every team the config knows about, for spotting one that has been renamed. */
export function knownTeams(): string[] {
  return Object.values(FUNCTION_GROUPS).flat().slice().sort();
}

/**
 * Teams present in the directory that no function claims. Surfaced on the
 * report so a rename shows up as a prompt to edit this file, rather than as a
 * quietly growing "Unassigned" bucket.
 */
export function unmappedTeams(teamsInUse: readonly string[]): string[] {
  const known = new Set(knownTeams().map((t) => t.toLowerCase()));
  return [
    ...new Set(
      teamsInUse.filter((t) => t && !known.has(t.trim().toLowerCase())),
    ),
  ].sort();
}
