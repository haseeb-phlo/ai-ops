import { createClient } from "@/lib/supabase/server";
import { championsByDisplayName } from "@/lib/champions";
import {
  ORG_TREE,
  namedEmails,
  coveredTeams,
  type OrgNode,
} from "@/lib/org";
import {
  OrgTreeClient,
  type OtherTeam,
  type ResolvedNode,
  type ResolvedPerson,
} from "./org-tree-client";

type PersonRow = {
  email: string;
  display_name: string;
  title: string;
  team: string;
  start_date: string | null;
};

/**
 * Tree-structured org view. Server resolves every person referenced in the
 * tree (CEO + L1s + their recursive directs) plus their team-member chips,
 * then hands the fully-built ResolvedNode shape to the client component
 * which renders + manages collapse state.
 */
export async function OrgView() {
  const supabase = await createClient();

  const [
    { data: people },
    { data: profiles },
    signedInRpc,
    userEmailsRpc,
    champByName,
  ] = await Promise.all([
    supabase
      .from("people")
      .select("email, display_name, title, team, start_date")
      .order("display_name", { ascending: true })
      .returns<PersonRow[]>(),
    supabase
      .from("profiles")
      .select("user_id, avatar_url")
      .returns<{ user_id: string; avatar_url: string | null }[]>(),
    supabase.rpc("signed_in_emails"),
    supabase.rpc("user_emails"),
    championsByDisplayName(),
  ]);

  const peopleRows = people ?? [];
  const peopleByEmail = new Map(
    peopleRows.map((p) => [p.email.toLowerCase(), p]),
  );

  // Resolve avatars by email → user_id → profiles.avatar_url. Keying by
  // display_name (the old approach) silently dropped avatars for any user
  // whose profile.display_name diverged from people.display_name - e.g.
  // anyone still on the email-local default "neal.archbold" while the
  // directory has "Neal Archbold".
  const userIdByEmail = new Map<string, string>();
  const userEmailsRows = (userEmailsRpc.data ?? []) as Array<{
    user_id: string;
    email: string | null;
  }>;
  for (const row of userEmailsRows) {
    if (row.email) userIdByEmail.set(row.email.toLowerCase(), row.user_id);
  }
  const avatarByUserId = new Map<string, string | null>();
  for (const pr of profiles ?? []) {
    avatarByUserId.set(pr.user_id, pr.avatar_url);
  }
  function avatarFor(email: string): string | null {
    const uid = userIdByEmail.get(email.toLowerCase());
    return uid ? avatarByUserId.get(uid) ?? null : null;
  }

  const signedInEmails = new Set<string>(
    Array.isArray(signedInRpc.data)
      ? (signedInRpc.data as string[]).map((e) => e.toLowerCase())
      : [],
  );

  function toResolved(row: PersonRow): ResolvedPerson {
    const lowerName = row.display_name.trim().toLowerCase();
    const champ = champByName.get(lowerName);
    return {
      email: row.email,
      displayName: row.display_name,
      title: row.title,
      team: row.team || null,
      startDate: row.start_date,
      avatarUrl: avatarFor(row.email),
      isSignedIn: signedInEmails.has(row.email.toLowerCase()),
      championTeam: champ?.team ?? null,
    };
  }

  function resolve(email: string): ResolvedPerson | null {
    const row = peopleByEmail.get(email.toLowerCase());
    return row ? toResolved(row) : null;
  }

  const named = namedEmails();

  /** Members of `teams` excluding the leader and any other named tree-people. */
  function teamMembers(
    teams: string[],
    excludeEmail: string,
  ): ResolvedPerson[] {
    if (teams.length === 0) return [];
    const teamSet = new Set(teams);
    return peopleRows
      .filter((p) => teamSet.has(p.team))
      .filter((p) => p.email.toLowerCase() !== excludeEmail.toLowerCase())
      .filter((p) => !named.has(p.email.toLowerCase()))
      .map(toResolved)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  function buildNode(node: OrgNode): ResolvedNode | null {
    const person = resolve(node.email);
    if (!person) return null;
    return {
      person,
      directs: node.directs
        .map(buildNode)
        .filter((n): n is ResolvedNode => n !== null),
      teamMembers: teamMembers(node.teams, node.email),
    };
  }

  const ceo = resolve(ORG_TREE.ceo.email);
  const l1 = ORG_TREE.l1
    .map(buildNode)
    .filter((n): n is ResolvedNode => n !== null);

  // Other teams: people whose team isn't owned by anyone in the tree.
  const covered = coveredTeams();
  const uncoveredByTeam = new Map<string, ResolvedPerson[]>();
  for (const p of peopleRows) {
    if (covered.has(p.team)) continue;
    if (named.has(p.email.toLowerCase())) continue;
    const arr = uncoveredByTeam.get(p.team) ?? [];
    arr.push(toResolved(p));
    uncoveredByTeam.set(p.team, arr);
  }
  const otherTeams: OtherTeam[] = [...uncoveredByTeam.entries()]
    .map(([team, members]) => ({
      team,
      members: members.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
    .sort((a, b) => a.team.localeCompare(b.team));

  return <OrgTreeClient ceo={ceo} l1={l1} otherTeams={otherTeams} />;
}
