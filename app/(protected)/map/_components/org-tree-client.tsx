"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { resolveAvatar } from "@/lib/profile";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ResolvedPerson = {
  email: string;
  displayName: string;
  title: string;
  team: string | null;
  startDate: string | null;
  avatarUrl: string | null;
  isSignedIn: boolean;
  championTeam: string | null;
};

export type ResolvedNode = {
  person: ResolvedPerson;
  directs: ResolvedNode[];
  teamMembers: ResolvedPerson[];
};

export type OtherTeam = {
  team: string;
  members: ResolvedPerson[];
};

const COLLAPSED_LABEL = "Show team";
const EXPANDED_LABEL = "Hide team";

function personMatches(p: ResolvedPerson, needle: string): boolean {
  return (
    p.displayName.toLowerCase().includes(needle) ||
    p.title.toLowerCase().includes(needle) ||
    (p.team ?? "").toLowerCase().includes(needle) ||
    p.email.toLowerCase().includes(needle)
  );
}

/**
 * Filter a node and its descendants against a search term. A node is kept
 * if itself OR any descendant OR any team-member chip matches; team chips
 * are filtered down to matches only when the parent is kept by descent.
 * Empty `needle` returns the node unchanged.
 */
function filterNode(node: ResolvedNode, needle: string): ResolvedNode | null {
  if (!needle) return node;
  const selfMatches = personMatches(node.person, needle);
  const directs = node.directs
    .map((d) => filterNode(d, needle))
    .filter((d): d is ResolvedNode => d !== null);
  const teamMembers = node.teamMembers.filter((m) => personMatches(m, needle));
  if (selfMatches) {
    // Show the full chip strip when the leader itself matches so the user
    // can read the team they own; sub-branches still filter to matches.
    return { person: node.person, directs, teamMembers: node.teamMembers };
  }
  if (directs.length > 0 || teamMembers.length > 0) {
    return { person: node.person, directs, teamMembers };
  }
  return null;
}

function filterOtherTeam(
  cluster: OtherTeam,
  needle: string,
): OtherTeam | null {
  if (!needle) return cluster;
  const teamHit = cluster.team.toLowerCase().includes(needle);
  const members = teamHit
    ? cluster.members
    : cluster.members.filter((m) => personMatches(m, needle));
  if (members.length === 0 && !teamHit) return null;
  return { team: cluster.team, members };
}

/**
 * Client component for the Org tree. The server pre-resolves everyone into
 * ResolvedNode; this component renders, tracks collapse state, and filters
 * by a free-text search across name/title/team/email.
 *
 * Each card with children (directs OR team members) gets a fold chevron
 * that hides everything below that node. Refresh = back to fully expanded.
 */
export function OrgTreeClient({
  ceo,
  l1,
  otherTeams,
}: {
  ceo: ResolvedPerson | null;
  l1: ResolvedNode[];
  otherTeams: OtherTeam[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [openPerson, setOpenPerson] = useState<ResolvedPerson | null>(null);

  const needle = query.trim().toLowerCase();

  const { filteredCeo, filteredL1, filteredOther, anyMatches } = useMemo(() => {
    const fl1 = l1
      .map((n) => filterNode(n, needle))
      .filter((n): n is ResolvedNode => n !== null);
    const fother = otherTeams
      .map((c) => filterOtherTeam(c, needle))
      .filter((c): c is OtherTeam => c !== null);
    const ceoHit = ceo && (!needle || personMatches(ceo, needle));
    const has =
      !!needle &&
      (fl1.length > 0 || fother.length > 0 || !!ceoHit);
    return {
      filteredCeo: needle && !ceoHit ? null : ceo,
      filteredL1: fl1,
      filteredOther: fother,
      anyMatches: has,
    };
  }, [ceo, l1, otherTeams, needle]);

  function toggle(email: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  const isSearching = needle.length > 0;
  const showEmpty = isSearching && !anyMatches;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, title, team, email"
          aria-label="Search people"
          className="w-full max-w-md sm:w-80"
        />
        {isSearching && (
          <p className="text-xs text-zinc-500">
            Showing matches for &ldquo;{query}&rdquo;.{" "}
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-zinc-700 underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </p>
        )}
      </div>

      {showEmpty ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          No people match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="space-y-12">
          {filteredCeo && (
            <div className="flex justify-center">
              <BigCard person={filteredCeo} onOpen={setOpenPerson} />
            </div>
          )}

          {/* L1 exec row - single line, scroll horizontally on narrow screens. */}
          {filteredL1.length > 0 && (
            <div className="-mx-2 overflow-x-auto pb-2">
              <div className="flex w-max items-start gap-x-5 px-2">
                {filteredL1.map((node) => (
                  <Branch
                    key={node.person.email}
                    node={node}
                    size="big"
                    collapsed={collapsed}
                    onToggle={toggle}
                    onOpen={setOpenPerson}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredOther.length > 0 && (
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
                {filteredOther
                  .slice()
                  .sort((a, b) => a.team.localeCompare(b.team))
                  .map((c) => (
                    <TeamCluster
                      key={c.team}
                      cluster={c}
                      onOpen={setOpenPerson}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PersonDialog
        person={openPerson}
        onOpenChange={(open) => {
          if (!open) setOpenPerson(null);
        }}
      />
    </div>
  );
}

function Branch({
  node,
  size,
  collapsed,
  onToggle,
  onOpen,
}: {
  node: ResolvedNode;
  size: "big" | "small";
  collapsed: Set<string>;
  onToggle: (email: string) => void;
  onOpen: (person: ResolvedPerson) => void;
}) {
  const hasChildren = node.directs.length > 0 || node.teamMembers.length > 0;
  const isCollapsed = collapsed.has(node.person.email);
  const Card = size === "big" ? BigCard : SmallCard;

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <Card
        person={node.person}
        canCollapse={hasChildren}
        isCollapsed={isCollapsed}
        onToggle={() => onToggle(node.person.email)}
        onOpen={onOpen}
      />

      {hasChildren && !isCollapsed && (
        <>
          <div className="h-3 w-px bg-zinc-300" aria-hidden />
          {node.directs.length > 0 && (
            <div className="flex shrink-0 items-start gap-x-4">
              {node.directs.map((d) => (
                <Branch
                  key={d.person.email}
                  node={d}
                  size="small"
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
          {node.teamMembers.length > 0 && (
            <div className="space-y-1.5">
              {node.teamMembers.map((m) => (
                <Chip key={m.email} person={m} onOpen={onOpen} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BigCard({
  person,
  canCollapse,
  isCollapsed,
  onToggle,
  onOpen,
}: {
  person: ResolvedPerson;
  canCollapse?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onOpen: (person: ResolvedPerson) => void;
}) {
  const dim = !person.isSignedIn ? "opacity-60" : "";
  const isChamp = !!person.championTeam;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen(person)}
        className={`relative flex w-44 flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-left hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${dim}`}
        title={
          isChamp ? `AI Champion of ${person.championTeam}` : person.displayName
        }
      >
        <span
          className="relative inline-block shrink-0 self-center"
          style={{ width: 56, height: 56 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAvatar(person.avatarUrl, person.email)}
            alt={person.displayName}
            className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
              isChamp
                ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
                : "ring-zinc-200"
            } ${person.isSignedIn ? "" : "grayscale"}`}
          />
          {isChamp && (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 items-center rounded-full bg-amber-400 px-1 font-mono text-[8px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
            >
              AI
            </span>
          )}
        </span>
        <div className="w-full text-center">
          <div className="truncate text-sm font-semibold text-zinc-900">
            {person.displayName}
          </div>
          <div className="line-clamp-2 text-xs text-zinc-500">
            {person.title}
          </div>
        </div>
      </button>
      {canCollapse && (
        <CollapseButton isCollapsed={!!isCollapsed} onClick={onToggle!} />
      )}
    </div>
  );
}

function SmallCard({
  person,
  canCollapse,
  isCollapsed,
  onToggle,
  onOpen,
}: {
  person: ResolvedPerson;
  canCollapse?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onOpen: (person: ResolvedPerson) => void;
}) {
  const dim = !person.isSignedIn ? "opacity-60" : "";
  const isChamp = !!person.championTeam;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen(person)}
        className={`relative flex w-36 flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-left hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${dim}`}
        title={
          isChamp ? `AI Champion of ${person.championTeam}` : person.displayName
        }
      >
        <span
          className="relative inline-block shrink-0 self-center"
          style={{ width: 40, height: 40 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAvatar(person.avatarUrl, person.email)}
            alt={person.displayName}
            className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
              isChamp
                ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
                : "ring-zinc-200"
            } ${person.isSignedIn ? "" : "grayscale"}`}
          />
          {isChamp && (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 items-center rounded-full bg-amber-400 px-1 font-mono text-[7px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
            >
              AI
            </span>
          )}
        </span>
        <div className="w-full text-center">
          <div className="truncate text-xs font-semibold text-zinc-900">
            {person.displayName}
          </div>
          <div className="line-clamp-2 text-[10px] leading-tight text-zinc-500">
            {person.title}
          </div>
        </div>
      </button>
      {canCollapse && (
        <CollapseButton isCollapsed={!!isCollapsed} onClick={onToggle!} />
      )}
    </div>
  );
}

function CollapseButton({
  isCollapsed,
  onClick,
}: {
  isCollapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={isCollapsed ? COLLAPSED_LABEL : EXPANDED_LABEL}
      title={isCollapsed ? COLLAPSED_LABEL : EXPANDED_LABEL}
      className="absolute -bottom-3 left-1/2 inline-flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:text-zinc-900"
    >
      <span aria-hidden className="text-xs leading-none">
        {isCollapsed ? "+" : "–"}
      </span>
    </button>
  );
}

function Chip({
  person,
  onOpen,
}: {
  person: ResolvedPerson;
  onOpen: (person: ResolvedPerson) => void;
}) {
  const dim = !person.isSignedIn ? "opacity-60" : "";
  const isChamp = !!person.championTeam;

  return (
    <button
      type="button"
      onClick={() => onOpen(person)}
      className={`flex w-44 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${dim}`}
      title={
        isChamp ? `AI Champion of ${person.championTeam}` : person.title
      }
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
            isChamp
              ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
              : "ring-zinc-200"
          } ${person.isSignedIn ? "" : "grayscale"}`}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
        {person.displayName}
      </span>
    </button>
  );
}

function TeamCluster({
  cluster,
  onOpen,
}: {
  cluster: OtherTeam;
  onOpen: (person: ResolvedPerson) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
          {cluster.team}
        </h3>
        <span className="text-xs text-zinc-500">
          {cluster.members.length}{" "}
          {cluster.members.length === 1 ? "person" : "people"}
        </span>
      </div>
      <ul className="space-y-1.5">
        {cluster.members.map((m) => (
          <li key={m.email}>
            <Chip person={m} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonDialog({
  person,
  onOpenChange,
}: {
  person: ResolvedPerson | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isChamp = !!person?.championTeam;
  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {person && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span
                  className="relative inline-block shrink-0"
                  style={{ width: 48, height: 48 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveAvatar(person.avatarUrl, person.email)}
                    alt={person.displayName}
                    className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
                      isChamp
                        ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
                        : "ring-zinc-200"
                    } ${person.isSignedIn ? "" : "grayscale"}`}
                  />
                  {isChamp && (
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 items-center rounded-full bg-amber-400 px-1 font-mono text-[8px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
                    >
                      AI
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate">
                    {person.displayName}
                  </DialogTitle>
                  <p className="truncate text-xs text-zinc-500">
                    {person.title || "—"}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Team
              </dt>
              <dd className="text-zinc-900">
                {person.team ?? <span className="text-zinc-400">-</span>}
              </dd>

              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Email
              </dt>
              <dd className="break-all text-zinc-700">{person.email}</dd>

              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Started
              </dt>
              <dd className="text-zinc-700">
                {person.startDate ? (
                  format(new Date(person.startDate), "d MMM yyyy")
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </dd>

              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Status
              </dt>
              <dd className="text-zinc-700">
                {person.isSignedIn ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-emerald-500"
                    />
                    Signed in
                  </span>
                ) : (
                  <span className="text-zinc-400">Not signed in yet</span>
                )}
              </dd>

              {isChamp && (
                <>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Champion of
                  </dt>
                  <dd>
                    <Link
                      href={`/champions/${encodeURIComponent(person.championTeam ?? "")}`}
                      className="text-amber-700 hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {person.championTeam}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
