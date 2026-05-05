"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertChampionNote,
  deleteChampionNote,
  type ChampionNoteState,
} from "./actions";

const initial: ChampionNoteState = { kind: "idle" };

export function NoteEditor({
  targetType,
  targetId,
  team,
  noteId,
  initialBody,
}: {
  targetType: "workflow" | "intervention";
  targetId: string;
  team: string;
  noteId: string | null;
  initialBody: string;
}) {
  const [editing, setEditing] = useState<boolean>(initialBody === "");
  const [state, action, pending] = useActionState(upsertChampionNote, initial);

  if (!editing && initialBody) {
    return (
      <div className="space-y-2">
        <div className="rounded-r-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          {initialBody}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit your team&apos;s note
          </Button>
          {noteId && (
            <form action={deleteChampionNote}>
              <input type="hidden" name="id" value={noteId} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-red-700"
              >
                Delete
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="team" value={team} />

      <Textarea
        name="body"
        defaultValue={initialBody}
        rows={3}
        maxLength={2000}
        placeholder={`Champion note for ${team} - editorial guidance for anyone reading this.`}
        className="border-amber-300 bg-amber-50/50 focus-visible:border-amber-500"
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : initialBody ? "Save" : "Post note"}
        </Button>
        {initialBody && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        )}
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
