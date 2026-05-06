import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Canonical list of team options for pickers across the app.
 *
 * Unions `people.team` (the source the People page filters on) with the
 * teams already in use on `workflows`, so the workflow create/edit pickers
 * surface every team a person has been assigned to and never drop a team
 * just because nobody on it has logged a workflow yet.
 *
 * `ensure` lets a caller guarantee a specific value stays in the list - e.g.
 * the current user's team or the workflow being edited's team - even if the
 * underlying queries don't return it.
 */
export async function loadTeamOptions(
  supabase: SupabaseClient,
  ensure?: string | null,
): Promise<string[]> {
  const [{ data: peopleTeams }, { data: workflowTeams }] = await Promise.all([
    supabase.from("people").select("team").not("team", "is", null),
    supabase
      .from("workflows")
      .select("team")
      .is("deleted_at", null)
      .not("team", "is", null),
  ]);

  const set = new Set<string>();
  for (const r of peopleTeams ?? []) {
    if (r.team) set.add(r.team);
  }
  for (const r of workflowTeams ?? []) {
    if (r.team) set.add(r.team);
  }
  if (ensure) set.add(ensure);

  return [...set].sort();
}

/**
 * Strict variant: only returns teams that exist on the People page. Use this
 * when the People page is the source of truth and other surfaces should not
 * accept teams that nobody belongs to (e.g. the profile picker).
 */
export async function loadPeopleTeams(
  supabase: SupabaseClient,
  ensure?: string | null,
): Promise<string[]> {
  const { data } = await supabase
    .from("people")
    .select("team")
    .not("team", "is", null);

  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.team) set.add(r.team);
  }
  if (ensure) set.add(ensure);

  return [...set].sort();
}

