import Link from "next/link";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { championsByTeam } from "@/lib/champions";
import { createClient } from "@/lib/supabase/server";
import { TextWithMentions } from "@/components/people/champion-mark";
import { NoteEditor } from "./note-editor";

type Note = {
  id: string;
  team: string;
  body: string;
  updated_at: string;
};

/**
 * Shared section that surfaces all champion notes left on a target plus,
 * inline, an editor for the team(s) the current user champions.
 *
 * `relevantTeams` is the set of teams whose champion can meaningfully comment
 * on this target:
 *   - workflows: pass the single owning team (only that team's champion).
 *   - interventions: pass the linked-workflow teams (any of those champions).
 *
 * The session user only sees an editor for teams in `relevantTeams` AND for
 * which they are the registered champion. Super-admins always see editors
 * for every relevant team.
 */
export async function ChampionNotesSection({
  targetType,
  targetId,
  relevantTeams,
}: {
  targetType: "workflow" | "intervention";
  targetId: string;
  relevantTeams: string[];
}) {
  const user = await getSessionUser();
  const supabase = await createClient();
  const byTeam = await championsByTeam();

  const { data: notes } = await supabase
    .from("champion_notes")
    .select("id, team, body, updated_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("updated_at", { ascending: false })
    .returns<Note[]>();

  const noteByTeam = new Map((notes ?? []).map((n) => [n.team, n]));
  const isSuper = user.role === "super_admin";

  // Editor slots: every relevant team where the user can write (champion or
  // super-admin), de-duped against teams that already have a note - those
  // notes get an inline editor instead of a separate slot.
  const editableTeams = new Set<string>();
  for (const t of relevantTeams) {
    if (isSuper) {
      editableTeams.add(t);
    } else {
      const c = byTeam.get(t);
      if (c?.user_id === user.id) editableTeams.add(t);
    }
  }

  // Read-only notes from teams the user can't edit
  const readOnlyNotes = (notes ?? []).filter((n) => !editableTeams.has(n.team));

  if (readOnlyNotes.length === 0 && editableTeams.size === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Champion notes
        </h2>
        <p className="text-xs text-muted-foreground">
          Editorial guidance from the AI champion of each affected team.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {readOnlyNotes.map((n) => (
          <li key={n.id} className="px-4 py-3 text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <Link
                href={`/champions/${encodeURIComponent(n.team)}`}
                className="font-medium text-foreground hover:underline"
              >
                {byTeam.get(n.team)?.display_name ?? n.team}
              </Link>
              <span className="text-muted-foreground">
                {format(new Date(n.updated_at), "d MMM yyyy")} ·{" "}
                <span className="text-muted-foreground">{n.team}</span>
              </span>
            </div>
            <p className="text-foreground">
              <TextWithMentions text={n.body} />
            </p>
          </li>
        ))}

        {[...editableTeams].sort().map((team) => {
          const existing = noteByTeam.get(team);
          return (
            <li key={`editor-${team}`} className="space-y-2 px-4 py-3">
              <div className="text-xs text-muted-foreground">
                You champion{" "}
                <Link
                  href={`/champions/${encodeURIComponent(team)}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {team}
                </Link>
              </div>
              <NoteEditor
                targetType={targetType}
                targetId={targetId}
                team={team}
                noteId={existing?.id ?? null}
                initialBody={existing?.body ?? ""}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
