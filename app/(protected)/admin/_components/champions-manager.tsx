"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  assignChampion,
  type AssignChampionState,
} from "../_actions/champions";

const initial: AssignChampionState = { kind: "idle" };

export type Person = {
  id: string;
  display_name: string;
  email: string;
  team: string;
};

export type ExistingChampion = {
  id: string;
  team: string;
  display_name: string;
  user_id: string | null;
};

/**
 * Admin tab manager for AI Champions. Pick a team, see who's already a
 * champion of it, add another or remove one. The "add" picker is search-
 * first so non-canonical team names (e.g. "Tech" vs "Technology") still
 * surface the directory - the previous strict `people.team === team`
 * filter silently produced empty dropdowns when those values diverged.
 */
export function ChampionsManager({
  teams,
  people,
  existing,
}: {
  teams: string[];
  people: Person[];
  existing: ExistingChampion[];
}) {
  const [team, setTeam] = useState<string>(teams[0] ?? "");
  const [picked, setPicked] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const championsByTeam = useMemo(() => {
    const m = new Map<string, ExistingChampion[]>();
    for (const c of existing) {
      const arr = m.get(c.team) ?? [];
      arr.push(c);
      m.set(c.team, arr);
    }
    return m;
  }, [existing]);

  const championsForSelected = useMemo(
    () => championsByTeam.get(team) ?? [],
    [championsByTeam, team],
  );

  // Already-a-champion lookups so the picker dedupes by display name.
  const existingNames = useMemo(
    () =>
      new Set(
        championsForSelected.map((c) =>
          c.display_name.trim().toLowerCase(),
        ),
      ),
    [championsForSelected],
  );

  // All directory people, with members of the selected team surfaced first
  // when the search field is empty. Already-champion rows are filtered out
  // server-side AND here so the picker is action-oriented.
  const allCandidates = useMemo(() => {
    const lowerTeam = team.toLowerCase();
    const isOnTeam = (p: Person) => p.team.toLowerCase() === lowerTeam;
    const filtered = people.filter(
      (p) => !existingNames.has(p.display_name.trim().toLowerCase()),
    );
    return [
      ...filtered.filter(isOnTeam),
      ...filtered.filter((p) => !isOnTeam(p)),
    ];
  }, [people, team, existingNames]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCandidates;
    return allCandidates.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q),
    );
  }, [allCandidates, search]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const [state, action, pending] = useActionState(assignChampion, initial);

  function pick(p: Person) {
    setPicked(p);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Assign a new champion
        </h2>
        <p className="text-xs text-zinc-500">
          Pick a team and a person from the directory. Existing champions
          appear in the &ldquo;All champions&rdquo; table below, where you
          can also remove.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Team
        </label>
        <Select
          value={team}
          onValueChange={(v) => {
            setTeam(v ?? "");
            setPicked(null);
            setSearch("");
          }}
        >
          <SelectTrigger className="sm:max-w-sm">
            <SelectValue placeholder="Pick a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => {
              const count = championsByTeam.get(t)?.length ?? 0;
              return (
                <SelectItem key={t} value={t}>
                  {t}
                  {count > 0
                    ? `  ·  ${count} ${count === 1 ? "champion" : "champions"}`
                    : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="person_id" value={picked?.id ?? ""} />

        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Add a champion
        </label>

        <div ref={containerRef} className="relative">
          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-900">
                  {picked.display_name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {[picked.team, picked.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={
                allCandidates.length === 0
                  ? "Everyone in the directory is already a champion"
                  : "Search by name, team, or email"
              }
              aria-label="Search people"
            />
          )}

          {open && !picked && allCandidates.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md">
              <div className="max-h-60 overflow-y-auto">
                {matches.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-zinc-500">
                    No matches.
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {matches.slice(0, 50).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => pick(p)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-zinc-900">
                              {p.display_name}
                            </span>
                            <span className="block truncate text-[11px] text-zinc-500">
                              {[p.team, p.email].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {matches.length > 50 && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500">
                  Showing first 50 - keep typing to narrow.
                </div>
              )}
            </div>
          )}
        </div>

        <Button type="submit" disabled={pending || !team || !picked}>
          {pending ? "Saving" : "Add champion"}
        </Button>
      </form>

      {state.kind === "ok" && (
        <p className="text-xs text-zinc-500">
          <span
            aria-hidden
            className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 align-middle"
          />
          Added a champion to{" "}
          <strong className="text-zinc-900">{state.team}</strong>
          {state.emailed ? ". Email sent." : "."}
        </p>
      )}
      {state.kind === "error" && (
        <p className="text-xs text-red-700">
          <span
            aria-hidden
            className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle"
          />
          {state.message}
        </p>
      )}
    </div>
  );
}
