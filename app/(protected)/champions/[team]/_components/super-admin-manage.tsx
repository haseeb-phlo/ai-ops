"use client";

import { useActionState, useState } from "react";
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
  type AssignChampionState,
} from "@/app/(protected)/admin/_actions/champions";

const initial: AssignChampionState = { kind: "idle" };

export type CandidatePerson = {
  id: string;
  display_name: string;
  email: string;
};

/**
 * Add-a-champion form for /champions/[team]. Per-row Remove buttons live
 * on each champion card above this form, so this component only handles
 * adding new champions to the team. Multiple champions per team are
 * supported (Executive being the canonical case).
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
  const [personId, setPersonId] = useState<string>("");
  const [state, action, pending] = useActionState(assignChampion, initial);

  const peopleById = new Map(candidates.map((p) => [p.id, p]));

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

      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="team" value={team} />
        <input type="hidden" name="person_id" value={personId} />

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            New champion
          </label>
          <Select
            value={personId}
            onValueChange={(v) => setPersonId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  candidates.length > 0
                    ? "Pick a person on this team"
                    : "No one in the directory for this team"
                }
              >
                {(v) => {
                  const p = peopleById.get(v as string);
                  return p ? `${p.display_name}  ·  ${p.email}` : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name}  ·  {p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          disabled={pending || !personId}
          className="self-end"
        >
          {pending ? "Saving..." : "Add champion"}
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
