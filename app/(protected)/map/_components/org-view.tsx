import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { championsByDisplayName } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import {
  ORG_TREE,
  namedEmails,
  coveredTeams,
  type OrgL1,
  type OrgLeaf,
} from "@/lib/org";

type PersonRow = {
  email: string;
  display_name: string;
  title: string;
  team: string;
};

type ResolvedPerson = {
  email: string;
  displayName: string;
  title: string;
  team: string | null;
  avatarUrl: string | null;
  isSignedIn: boolean;
};

/**
 * Tree-structured org view. Same visual vocabulary as the rest of the app
 * (avatar, name, title; champions glow amber) but laid out top-down rather
 * than as a force-directed galaxy.
 */
export async function OrgView() {
  const supabase = await createClient();

  const [
    { data: people },
    { data: profiles },
    signedInRpc,
    champByName,
  ] = await Promise.all([
    supabase
      .from("people")
      .select("email, display_name, title, team")
      .order("display_name", { ascending: true })
      .returns<PersonRow[]>(),
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .returns<{ display_name: string | null; avatar_url: string | null }[]>(),
    supabase.rpc("signed_in_emails"),
    championsByDisplayName(),
  ]);

  const peopleRows = people ?? [];
  const peopleByEmail = new Map(
    peopleRows.map((p) => [p.email.toLowerCase(), p]),
  );

  const avatarByLowerName = new Map<string, string | null>();
  for (const pr of profiles ?? []) {
    if (pr.display_name) {
      avatarByLowerName.set(
        pr.display_name.trim().toLowerCase(),
        pr.avatar_url,
      );
    }
  }

  const signedInEmails = new Set<string>(
    Array.isArray(signedInRpc.data)
      ? (signedInRpc.data as string[]).map((e) => e.toLowerCase())
      : [],
  );

  function resolve(email: string): ResolvedPerson | null {
    const row = peopleByEmail.get(email.toLowerCase());
    if (!row) return null;
    const lowerName = row.display_name.trim().toLowerCase();
    return {
      email: row.email,
      displayName: row.display_name,
      title: row.title,
      team: row.team || null,
      avatarUrl: avatarByLowerName.get(lowerName) ?? null,
      isSignedIn: signedInEmails.has(row.email.toLowerCase()),
    };
  }

  function teamMembers(
    team: string,
    excludeEmail: string,
    excludeNamed: Set<string>,
  ): ResolvedPerson[] {
    return peopleRows
      .filter(
        (p) =>
          p.team === team &&
          p.email.toLowerCase() !== excludeEmail.toLowerCase() &&
          !excludeNamed.has(p.email.toLowerCase()),
      )
      .map((p) => {
        const lowerName = p.display_name.trim().toLowerCase();
        return {
          email: p.email,
          displayName: p.display_name,
          title: p.title,
          team: p.team || null,
          avatarUrl: avatarByLowerName.get(lowerName) ?? null,
          isSignedIn: signedInEmails.has(p.email.toLowerCase()),
        };
      });
  }

  const named = namedEmails();
  const covered = coveredTeams();

  const adam = resolve(ORG_TREE.ceo.email);

  // Compute uncovered team clusters (people whose team isn't owned by any
  // named leader). Excludes named individuals themselves.
  const uncoveredByTeam = new Map<string, ResolvedPerson[]>();
  for (const p of peopleRows) {
    if (covered.has(p.team)) continue;
    if (named.has(p.email.toLowerCase())) continue;
    const arr = uncoveredByTeam.get(p.team) ?? [];
    const lowerName = p.display_name.trim().toLowerCase();
    arr.push({
      email: p.email,
      displayName: p.display_name,
      title: p.title,
      team: p.team || null,
      avatarUrl: avatarByLowerName.get(lowerName) ?? null,
      isSignedIn: signedInEmails.has(p.email.toLowerCase()),
    });
    uncoveredByTeam.set(p.team, arr);
  }

  return (
    <div className="space-y-12 px-2">
      {/* CEO */}
      {adam && (
        <div className="flex justify-center">
          <BigCard person={adam} champByName={champByName} />
        </div>
      )}

      {/* L1 row + their subtrees */}
      <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-10">
        {ORG_TREE.l1.map((l1) => {
          const leader = resolve(l1.email);
          if (!leader) return null;
          return (
            <L1Branch
              key={l1.email}
              l1={l1}
              leader={leader}
              resolve={resolve}
              teamMembers={teamMembers}
              named={named}
              champByName={champByName}
            />
          );
        })}
      </div>

      {/* Other teams (uncovered clusters) */}
      {uncoveredByTeam.size > 0 && (
        <div className="space-y-4 border-t border-zinc-200 pt-8">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
              Other teams
            </h2>
            <p className="text-xs text-zinc-500">
              Teams not assigned to a named leader in the tree above.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...uncoveredByTeam.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([team, members]) => (
                <TeamCluster
                  key={team}
                  team={team}
                  members={members}
                  champByName={champByName}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function L1Branch({
  l1,
  leader,
  resolve,
  teamMembers,
  named,
  champByName,
}: {
  l1: OrgL1;
  leader: ResolvedPerson;
  resolve: (email: string) => ResolvedPerson | null;
  teamMembers: (
    team: string,
    excludeEmail: string,
    excludeNamed: Set<string>,
  ) => ResolvedPerson[];
  named: Set<string>;
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  const isAlistair = l1.directs.length > 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <BigCard person={leader} champByName={champByName} />

      {/* Connector */}
      {(isAlistair || l1.team) && (
        <div className="h-4 w-px bg-zinc-300" aria-hidden />
      )}

      {isAlistair ? (
        <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-8">
          {l1.directs.map((l2) => (
            <L2Branch
              key={l2.email}
              l2={l2}
              resolve={resolve}
              teamMembers={teamMembers}
              named={named}
              champByName={champByName}
            />
          ))}
        </div>
      ) : l1.team ? (
        <TeamStack
          members={teamMembers(l1.team, l1.email, named)}
          champByName={champByName}
        />
      ) : null}
    </div>
  );
}

function L2Branch({
  l2,
  resolve,
  teamMembers,
  named,
  champByName,
}: {
  l2: OrgLeaf;
  resolve: (email: string) => ResolvedPerson | null;
  teamMembers: (
    team: string,
    excludeEmail: string,
    excludeNamed: Set<string>,
  ) => ResolvedPerson[];
  named: Set<string>;
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  const person = resolve(l2.email);
  if (!person) return null;
  const members = l2.team ? teamMembers(l2.team, l2.email, named) : [];
  return (
    <div className="flex flex-col items-center gap-3">
      <SmallCard person={person} champByName={champByName} />
      {l2.team && members.length > 0 && (
        <>
          <div className="h-3 w-px bg-zinc-300" aria-hidden />
          <TeamStack members={members} champByName={champByName} />
        </>
      )}
    </div>
  );
}

function BigCard({
  person,
  champByName,
}: {
  person: ResolvedPerson;
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  const champ =
    champByName.get(person.displayName.trim().toLowerCase()) ?? null;
  const dim = !person.isSignedIn ? "opacity-50" : "";

  const inner = (
    <div
      className={`flex w-44 flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-300 ${dim}`}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: 56, height: 56 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAvatar(person.avatarUrl, person.email)}
          alt={person.displayName}
          className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
            champ
              ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
              : "ring-zinc-200"
          } ${person.isSignedIn ? "" : "grayscale"}`}
        />
        {champ && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-white"
          >
            ⚡
          </span>
        )}
      </span>
      <div className="text-center">
        <div className="truncate text-sm font-semibold text-zinc-900">
          {person.displayName}
        </div>
        <div className="line-clamp-2 text-xs text-zinc-500">
          {person.title}
        </div>
      </div>
    </div>
  );

  if (champ) {
    return (
      <Link
        href={`/champions/${encodeURIComponent(champ.team)}`}
        title={`AI Champion of ${champ.team}`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function SmallCard({
  person,
  champByName,
}: {
  person: ResolvedPerson;
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  const champ =
    champByName.get(person.displayName.trim().toLowerCase()) ?? null;
  const dim = !person.isSignedIn ? "opacity-50" : "";

  const inner = (
    <div
      className={`flex w-36 flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 ${dim}`}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: 40, height: 40 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAvatar(person.avatarUrl, person.email)}
          alt={person.displayName}
          className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
            champ
              ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
              : "ring-zinc-200"
          } ${person.isSignedIn ? "" : "grayscale"}`}
        />
        {champ && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold leading-none text-white shadow-sm ring-1 ring-white"
          >
            ⚡
          </span>
        )}
      </span>
      <div className="text-center">
        <div className="truncate text-xs font-semibold text-zinc-900">
          {person.displayName}
        </div>
        <div className="line-clamp-2 text-[10px] leading-tight text-zinc-500">
          {person.title}
        </div>
      </div>
    </div>
  );

  if (champ) {
    return (
      <Link
        href={`/champions/${encodeURIComponent(champ.team)}`}
        title={`AI Champion of ${champ.team}`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function TeamStack({
  members,
  champByName,
}: {
  members: ResolvedPerson[];
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  if (members.length === 0) return null;
  return (
    <ul className="flex max-w-44 flex-col items-stretch gap-1.5">
      {members.map((m) => (
        <li key={m.email}>
          <Chip person={m} champByName={champByName} />
        </li>
      ))}
    </ul>
  );
}

function Chip({
  person,
  champByName,
}: {
  person: ResolvedPerson;
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  const champ =
    champByName.get(person.displayName.trim().toLowerCase()) ?? null;
  const dim = !person.isSignedIn ? "opacity-50" : "";

  return (
    <span
      className={`flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 ${dim}`}
      title={person.title}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: 22, height: 22 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveAvatar(person.avatarUrl, person.email)}
          alt={person.displayName}
          className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
            champ
              ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
              : "ring-zinc-200"
          } ${person.isSignedIn ? "" : "grayscale"}`}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
        {person.displayName}
      </span>
    </span>
  );
}

function TeamCluster({
  team,
  members,
  champByName,
}: {
  team: string;
  members: ResolvedPerson[];
  champByName: Map<string, { team: string; display_name: string }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
          {team}
        </h3>
        <span className="text-xs text-zinc-500">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </div>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.email}>
            <Chip person={m} champByName={champByName} />
          </li>
        ))}
      </ul>
    </div>
  );
}
