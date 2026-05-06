"use client";

import { useActionState } from "react";
import {
  updateChampionEditorial,
  type ChampionEditorialState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initial: ChampionEditorialState = { kind: "idle" };

export function EditorialForm({
  team,
  championId,
  defaultBlurb,
  defaultChewingOn,
}: {
  team: string;
  championId: string;
  defaultBlurb: string;
  defaultChewingOn: string;
}) {
  const [state, action, pending] = useActionState(
    updateChampionEditorial,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="champion_id" value={championId} />
      <input type="hidden" name="team" value={team} />

      <div className="space-y-1">
        <label
          htmlFor="blurb"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Your message to the team
        </label>
        <Textarea
          id="blurb"
          name="blurb"
          defaultValue={defaultBlurb}
          rows={3}
          maxLength={2000}
          placeholder="A sentence or two on what you're trying to do as champion."
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="chewing_on"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          An open question
        </label>
        <Textarea
          id="chewing_on"
          name="chewing_on"
          defaultValue={defaultChewingOn}
          rows={2}
          maxLength={2000}
          placeholder="Something you'd like the team to weigh in on."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {state.kind === "ok" && (
          <span className="text-xs text-emerald-700">Saved.</span>
        )}
        {state.kind === "error" && (
          <span className="text-xs text-red-700">{state.message}</span>
        )}
      </div>
    </form>
  );
}
