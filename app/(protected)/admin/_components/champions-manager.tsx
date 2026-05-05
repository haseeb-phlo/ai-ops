"use client";

import { useActionState, useMemo, useState } from "react";
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
  team: string;
  display_name: string;
  user_id: string | null;
};

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

  const championByTeam = useMemo(
    () => new Map(existing.map((c) => [c.team, c])),
    [existing],
  );

  const [state, action, pending] = useActionState(assignChampion, initial);
  const currentChampion = championByTeam.get(team);

  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Assign or replace a champion
        </h2>
        <p className="text-xs text-zinc-500">
          Super-admin only. The picked person gets an email letting them know
          they&apos;ve been made champion.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
            <SelectTrigger>
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                  {championByTeam.has(t) ? "  ·  has champion" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentChampion && (
            <p className="text-xs text-zinc-500">
              Current: <strong>{currentChampion.display_name}</strong>
              {currentChampion.user_id ? "" : "  ·  hasn't signed in yet"}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            New champion
          </label>
          <Select
            value={personId}
            onValueChange={(v) => setPersonId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  peopleForTeam.length > 0
                    ? "Pick a person"
                    : "No one on this team in the directory"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {peopleForTeam.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}  ·  {p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-stretch gap-2 self-end sm:flex-row">
          {/* Assign / replace runs the assignChampion action. */}
          <form action={action}>
            <input type="hidden" name="team" value={team} />
            <input type="hidden" name="person_id" value={personId} />
            <Button
              type="submit"
              disabled={pending || !team || !personId}
              className="w-full sm:w-auto"
            >
              {pending
                ? "Assigning..."
                : currentChampion
                ? "Replace champion"
                : "Assign champion"}
            </Button>
          </form>

          {/* Remove is a sibling form so the two submit buttons don't fight. */}
          {currentChampion && (
            <form action={removeChampion}>
              <input type="hidden" name="team" value={team} />
              <Button
                type="submit"
                variant="outline"
                className="w-full text-red-700 sm:w-auto"
              >
                Remove
              </Button>
            </form>
          )}
        </div>
      </div>

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
    </div>
  );
}
