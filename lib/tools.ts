import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Distinct list of tool names previously recorded on workflows or
 * interventions. Drives the autocomplete dropdown in the tag-input so the
 * same tool (e.g. "Claude") converges across rows instead of drifting into
 * "claude.ai" / "Anthropic Claude". Casing of the first writer wins.
 */
export async function loadToolSuggestions(
  supabase: SupabaseClient,
): Promise<string[]> {
  const [{ data: workflowRows }, { data: interventionRows }] = await Promise.all([
    supabase
      .from("workflows")
      .select("tools_used")
      .is("deleted_at", null),
    supabase.from("ai_interventions").select("tools_used"),
  ]);

  // First-seen casing wins so the dropdown stays stable across sessions.
  const seen = new Map<string, string>();
  for (const r of [...(workflowRows ?? []), ...(interventionRows ?? [])]) {
    const list = (r.tools_used as string[] | null) ?? [];
    for (const raw of list) {
      const tag = (raw ?? "").trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}
