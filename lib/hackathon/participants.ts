import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";

/**
 * The hackathon's guest list, for the person who writes it.
 *
 * Only a super admin ever loads this - `read own hackathon_participants`
 * gives everyone else their own row and nothing else - so it joins the
 * people directory for names and reports who has answered.
 *
 * An address that is not in the directory is kept and shown as the address:
 * the register is the invitation, and the directory can lag it.
 */

export type Participant = {
  id: string;
  email: string;
  displayName: string;
  team: string | null;
  /** In the people directory, so the name above is a real one. */
  known: boolean;
  hasResponded: boolean;
  addedAt: string;
};

export async function loadParticipants(): Promise<Participant[]> {
  const supabase = await createClient();
  const [rosterRes, peopleRes, responsesRes] = await Promise.all([
    supabase
      .from("hackathon_participants")
      .select("id, email, created_at")
      .order("created_at", { ascending: true })
      .returns<{ id: string; email: string; created_at: string }[]>(),
    supabase
      .from("people")
      .select("email, display_name, team")
      .returns<
        { email: string; display_name: string | null; team: string | null }[]
      >(),
    supabase
      .from("hackathon_survey_responses")
      .select("email")
      .returns<{ email: string }[]>(),
  ]);

  if (rosterRes.error) {
    throw new Error(`Failed to load participants: ${rosterRes.error.message}`);
  }

  const directory = new Map(
    (peopleRes.data ?? []).map((p) => [p.email.toLowerCase(), p]),
  );
  const answered = new Set(
    (responsesRes.data ?? []).map((r) => r.email.toLowerCase()),
  );

  return (rosterRes.data ?? []).map((row) => {
    const person = directory.get(row.email);
    return {
      id: row.id,
      email: row.email,
      displayName: resolveDisplayName(null, person?.display_name, row.email),
      team: person?.team ?? null,
      known: !!person,
      hasResponded: answered.has(row.email),
      addedAt: row.created_at,
    };
  });
}
