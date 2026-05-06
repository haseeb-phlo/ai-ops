"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignChampion,
  removeChampion,
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
 * Admin tab manager for AI Champions. Supports multiple champions per team
 * (Executive being the canonical case) - pick a team, see who's already a
 * champion of it with per-row Remove, and add another below.
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
  const [personId, setPersonId] = useState<string>("");

  const peopleForTeam = useMemo(
    () => people.filter((p) => p.team === team),
    [people, team],
  );

  const championsByTeam = useMemo(() => {
    const m = new Map<string, ExistingChampion[]>();
    for (const c of existing) {
      const arr = m.get(c.team) ?? [];
      arr.push(c);
      m.set(c.team, arr);
    }
    return m;
  }, [existing]);

  const championsForSelected = championsByTeam.get(team) ?? [];

  // Filter out people who are already champions of this team so the
  // picker doesn't surface duplicates that'll error on insert.
  const existingUserIds = new Set(
    championsForSelected.map((c) => c.user_id).filter(Boolean) as string[],
  );
  const availablePeople = peopleForTeam.filter((p) => {
    // We don't have user_id on `people` - best-effort dedupe via display
    // name (the assign action always re-resolves user_id from the email
    // anyway, so a stale duplicate would be caught server-side).
    const championNames = new Set(
      championsForSelected.map((c) => c.display_name.trim().toLowerCase()),
    );
    if (championNames.has(p.display_name.trim().toLowerCase())) return false;
    return !existingUserIds.has(p.id);
  });

  const peopleById = new Map(people.map((p) => [p.id, p]));

  const [state, action, pending] = useActionState(assignChampion, initial);

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Manage champions
        </h2>
        <p className="text-xs text-zinc-500">
          Pick a team, see who&apos;s already a champion, and add more if you
          need to. Multiple champions per team is supported.
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
            setPersonId("");
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

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Current champions
        </h3>
        {championsForSelected.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-200 px-3 py-3 text-xs text-zinc-500">
            None yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {championsForSelected.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <Link
                  href={`/champions/${encodeURIComponent(c.team)}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {c.display_name}
                </Link>
                <span className="text-xs text-zinc-500">
                  {c.user_id ? "" : "hasn't signed in yet"}
                </span>
                <form action={removeChampion}>
                  <input type="hidden" name="champion_id" value={c.id} />
                  <input type="hidden" name="team" value={c.team} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="text-red-700"
                  >
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="person_id" value={personId} />

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Add a champion
          </label>
          <Select
            value={personId}
            onValueChange={(v) => setPersonId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  availablePeople.length > 0
                    ? "Pick a person"
                    : peopleForTeam.length === 0
                    ? "No one on this team in the directory"
                    : "Everyone on this team is already a champion"
                }
              >
                {(v) => {
                  const p = peopleById.get(v as string);
                  return p ? `${p.display_name}  ·  ${p.email}` : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availablePeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}  ·  {p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          disabled={pending || !team || !personId}
          className="self-end"
        >
          {pending ? "Saving..." : "Add champion"}
        </Button>
      </form>

      {state.kind === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Added a champion to <strong>{state.team}</strong>.
          {state.emailed ? " Email sent." : null}
          {state.emailNote ? ` ${state.emailNote}` : null}
        </div>
      )}
      {state.kind === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {state.message}
        </div>
      )}
    </div>
  );
}
