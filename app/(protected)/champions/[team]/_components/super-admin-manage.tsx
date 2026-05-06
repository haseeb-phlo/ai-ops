"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  assignChampion,
  type AssignChampionState,
} from "@/app/(protected)/admin/_actions/champions";

const initial: AssignChampionState = { kind: "idle" };

export type CandidatePerson = {
  id: string;
  display_name: string;
  email: string;
  team?: string | null;
};

/**
 * Add-a-champion form for /champions/[team]. Per-row Remove buttons live
 * on each champion card above this form, so this component only handles
 * adding new champions to the team. Multiple champions per team are
 * supported (Executive being the canonical case).
 *
 * The picker is search-first because the directory can be 75+ rows; a flat
 * Select would be unusable. Members of the URL team are surfaced first when
 * the search field is empty so the common case (team-mate) is one click,
 * while non-canonical team names (e.g. /champions/Tech vs people.team
 * "Technology") still let a super-admin pick anyone in the directory.
 */
export function SuperAdminManage({
  team,
  candidates,
  championCount,
}: {
  team: string;
  candidates: CandidatePerson[];
  championCount: number;
}) {
  const [picked, setPicked] = useState<CandidatePerson | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState(assignChampion, initial);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q),
    );
  }, [candidates, search]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // After a successful save, clear the picker so the form is ready for the
  // next champion (most teams have one but Executive accumulates several).
  useEffect(() => {
    if (state.kind === "ok") {
      setPicked(null);
      setSearch("");
    }
  }, [state.kind]);

  function pick(p: CandidatePerson) {
    setPicked(p);
    setSearch("");
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          {championCount === 0 ? "Assign a champion" : "Add a champion"}
        </h2>
        <p className="text-xs text-zinc-500">
          {championCount === 0
            ? "Pick a person from the directory. They'll get an email letting them know they've been made champion."
            : "Add another person as champion of this team. Useful for cross-functional teams (e.g. Executive)."}
        </p>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="person_id" value={picked?.id ?? ""} />

        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          New champion
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
                candidates.length === 0
                  ? "No one in the directory"
                  : "Search by name, team, or email"
              }
              aria-label="Search people"
            />
          )}

          {open && !picked && candidates.length > 0 && (
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

        <Button type="submit" disabled={pending || !picked}>
          {pending ? "Saving" : "Add champion"}
        </Button>
      </form>

      {state.kind === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Champion of <strong>{state.team}</strong> saved.
          {state.emailed ? " Email sent." : null}
          {state.emailNote ? ` ${state.emailNote}` : null}
        </div>
      )}
      {state.kind === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {state.message}
        </div>
      )}
    </section>
  );
}
