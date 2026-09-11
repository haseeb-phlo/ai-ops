"use client";

import { useActionState, useState } from "react";
import { UserPlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/hackathon/participants";
import {
  addParticipants,
  removeParticipant,
  type RosterState,
} from "../_actions/participants";

/**
 * Who the hackathon is for - the super admin's view, and the only way to
 * change it.
 *
 * On the hackathon page rather than in /admin: the organiser is here
 * watching answers arrive, and "why has X not answered" is usually "X is not
 * on the list". It shows who has answered for the same reason.
 */
export function RosterPanel({
  participants,
}: {
  participants: readonly Participant[];
}) {
  const [text, setText] = useState("");
  const [addState, add, adding] = useActionState<RosterState, FormData>(
    addParticipants,
    { kind: "idle" },
  );
  const [removeState, remove] = useActionState<RosterState, FormData>(
    removeParticipant,
    { kind: "idle" },
  );

  const answered = participants.filter((p) => p.hasResponded).length;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Who this is for
        </h2>
        <p className="text-xs text-muted-foreground">
          {participants.length === 0
            ? "Nobody on the list yet"
            : `${answered} of ${participants.length} answered`}
        </p>
      </div>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        Only these people see the Hackathon tab. Paste addresses one per line,
        comma separated, or straight from a To: field. Someone who has never
        signed in can go on the list now.
      </p>

      <form action={add} className="mt-3 space-y-2">
        <textarea
          name="emails"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          aria-label="Addresses to add"
          placeholder="someone@wearephlo.com&#10;someone.else@wearephlo.com"
          className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={adding || text.trim() === ""}>
            <UserPlusIcon aria-hidden />
            {adding ? "Adding…" : "Add to the list"}
          </Button>
          {addState.kind !== "idle" && (
            <span
              role="status"
              className={cn(
                "text-xs",
                addState.kind === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {addState.message}
            </span>
          )}
        </div>
      </form>

      {removeState.kind === "error" && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {removeState.message}
        </p>
      )}

      {participants.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {participants.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {person.displayName}
                {person.team && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {person.team}
                  </span>
                )}
                {!person.known && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    not in the directory
                  </span>
                )}
              </span>
              <Badge variant="outline" className="gap-1.5 bg-card">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    person.hasResponded
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/60",
                  )}
                />
                {person.hasResponded ? "Answered" : "Not yet"}
              </Badge>
              <form action={remove}>
                <input type="hidden" name="id" value={person.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Take ${person.displayName} off the list`}
                >
                  <XIcon aria-hidden />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
