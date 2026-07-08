import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
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

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
};

/**
 * Tree-structured org view. Server resolves every person referenced in the
 * tree (CEO + L1s + their recursive directs) plus their team-member chips,
 * then hands the fully-built ResolvedNode shape to the client component
 * which renders + manages collapse state.
 *
 * Directory rows are the base, but a signed-in user's own profile edits win
 * where they exist: `profiles.display_name`/`title` and the `role_grants`
 * team (matched by email) overlay the seeded `people` values, mirroring the
 * profile → people → email-local-part precedence in `resolveDisplayName`.
 * Without this overlay, profile edits never reached the directory.
 */
export async function OrgView() {
  const supabase = await createClient();

  const [
    { data: people },
    { data: profiles },
    { data: grants },
    signedInRpc,
  ] = await Promise.all([
    supabase
      .from("people")
      .select("email, display_name, title, team, start_date")
      .order("display_name", { ascending: true })
      .returns<PersonRow[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, title")
      .returns<ProfileRow[]>(),
    supabase
      .from("role_grants")
      .select("user_id, team")
      .returns<{ user_id: string; team: string | null }[]>(),
    supabase.rpc("signed_in_emails"),
  ]);

  // Resolve user_id → email for the profile user_ids we just loaded so the
  // per-email overlay maps can be built. user_emails requires an explicit list.
  const profileUserIds = (profiles ?? []).map((p) => p.user_id);
  const userEmailsRpc =
    profileUserIds.length === 0
      ? { data: [] as Array<{ user_id: string; email: string | null }> }
      : await supabase.rpc("user_emails", { p_user_ids: profileUserIds });

  // email → user_id → profile / grant. Keying by email (the canonical join
  // key with the people directory) rather than display_name means edits
  // survive users renaming themselves on the profile page.
  const userIdByEmail = new Map<string, string>();
  const userEmailsRows = (userEmailsRpc.data ?? []) as Array<{
    user_id: string;
    email: string | null;
  }>;
  for (const row of userEmailsRows) {
    if (row.email) userIdByEmail.set(row.email.toLowerCase(), row.user_id);
  }
  const profileByUserId = new Map<string, ProfileRow>();
  for (const pr of profiles ?? []) {
    profileByUserId.set(pr.user_id, pr);
  }
  const grantTeamByUserId = new Map<string, string | null>();
  for (const g of grants ?? []) {
    grantTeamByUserId.set(g.user_id, g.team ?? null);
  }

  // Overlay applied *before* any grouping so team-member chips and "other
  // teams" clusters bucket people under their effective team.
  function overlay(row: PersonRow): PersonRow {
    const uid = userIdByEmail.get(row.email.toLowerCase());
    if (!uid) return row;
    const profile = profileByUserId.get(uid);
    const grantTeam = grantTeamByUserId.get(uid);
    return {
      ...row,
      display_name: resolveDisplayName(
        profile?.display_name,
        row.display_name,
        row.email,
      ),
      title: profile?.title?.trim() ? profile.title.trim() : row.title,
      team: grantTeam?.trim() ? grantTeam : row.team,
    };
  }

  const peopleRows = (people ?? []).map(overlay);
  const peopleByEmail = new Map(
    peopleRows.map((p) => [p.email.toLowerCase(), p]),
  );

  function avatarFor(email: string): string | null {
    const uid = userIdByEmail.get(email.toLowerCase());
    return uid ? profileByUserId.get(uid)?.avatar_url ?? null : null;
  }

  const signedInEmails = new Set<string>(
    Array.isArray(signedInRpc.data)
      ? (signedInRpc.data as string[]).map((e) => e.toLowerCase())
      : [],
  );

  function toResolved(row: PersonRow): ResolvedPerson {
    return {
      email: row.email,
      displayName: row.display_name,
      title: row.title,
      team: row.team || null,
      startDate: row.start_date,
      avatarUrl: avatarFor(row.email),
      isSignedIn: signedInEmails.has(row.email.toLowerCase()),
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
