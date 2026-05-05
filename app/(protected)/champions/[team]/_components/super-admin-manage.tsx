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
  removeChampion,
  type AssignChampionState,
} from "@/app/(protected)/admin/_actions/champions";

const initial: AssignChampionState = { kind: "idle" };

export type CandidatePerson = {
  id: string;
  display_name: string;
  email: string;
};

export function SuperAdminManage({
  team,
  candidates,
  currentChampion,
}: {
  team: string;
  candidates: CandidatePerson[];
  currentChampion: { display_name: string; user_id: string | null };
}) {
  const [personId, setPersonId] = useState<string>("");
  const [state, action, pending] = useActionState(assignChampion, initial);

  const peopleById = new Map(candidates.map((p) => [p.id, p]));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Manage champion
        </h2>
        <p className="text-xs text-zinc-500">
          Super admin only. Replacing assigns the new person and emails them;
          removing leaves the team without a champion until you assign a new
          one.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
        <form action={action} className="contents">
          <input type="hidden" name="team" value={team} />
          <input type="hidden" name="person_id" value={personId} />

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Replace with
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
            {pending ? "Saving..." : "Replace champion"}
          </Button>
        </form>

        {/* Sibling form so submit buttons don't collide. */}
        <form action={removeChampion} className="self-end">
          <input type="hidden" name="team" value={team} />
          <Button type="submit" variant="outline" className="text-red-700">
            Remove
          </Button>
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Current: <strong>{currentChampion.display_name}</strong>
        {currentChampion.user_id ? "" : "  ·  hasn't signed in yet"}
      </p>

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
