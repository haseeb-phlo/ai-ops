"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  nextAttendanceStatus,
  type AttendanceStatus,
} from "@/lib/programme/attendance";
import { markAttendance } from "../actions";

export type RosterMember = {
  cohortMemberId: string;
  userId: string;
  displayName: string;
  attendance: Record<
    string,
    { status: AttendanceStatus; makeUp: boolean; slot: number | null }
  >;
};

export type RosterSession = {
  trackItemId: string;
  title: string;
  slotDates: string[];
};

/** Cell appearance per state. Colour lives in a dot, per the app's grammar. */
const CELL: Record<AttendanceStatus, { dot: string; short: string; label: string }> = {
  attended: { dot: "bg-success", short: "A", label: "Attended" },
  absent: { dot: "bg-destructive", short: "-", label: "Absent" },
  excused: { dot: "bg-warning", short: "E", label: "Excused" },
};

/**
 * Members x sessions, tap to cycle.
 *
 * Built for speed: this gets filled in during or straight after a session, so
 * every cell is one tap and the write is optimistic. A dual-slot session shows
 * a slot toggle in the header; attending EITHER slot satisfies the item, so
 * the slot is recorded for the organiser, not as a second hurdle.
 */
export function RosterGrid({
  cohortId,
  members,
  sessions,
}: {
  cohortId: string;
  members: RosterMember[];
  sessions: RosterSession[];
}) {
  const [state, setState] = useState<
    Record<string, { status: AttendanceStatus | null; makeUp: boolean }>
  >(() => {
    const initial: Record<
      string,
      { status: AttendanceStatus | null; makeUp: boolean }
    > = {};
    for (const m of members) {
      for (const [itemId, a] of Object.entries(m.attendance)) {
        initial[`${m.userId}:${itemId}`] = {
          status: a.status,
          makeUp: a.makeUp,
        };
      }
    }
    return initial;
  });
  const [slotBySession, setSlotBySession] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const cycle = (member: RosterMember, session: RosterSession) => {
    const key = `${member.userId}:${session.trackItemId}`;
    const current = state[key] ?? { status: null, makeUp: false };
    const next = nextAttendanceStatus(current.status);
    const makeUp = next === "excused" ? current.makeUp : false;

    setState((prev) => ({ ...prev, [key]: { status: next, makeUp } }));
    setError(null);

    startTransition(async () => {
      const result = await markAttendance({
        cohortId,
        trackItemId: session.trackItemId,
        userId: member.userId,
        status: next,
        slot: session.slotDates.length > 1
          ? (slotBySession[session.trackItemId] ?? 1)
          : null,
        makeUp,
      });
      if (!result.ok) {
        setState((prev) => ({ ...prev, [key]: current }));
        setError(result.message);
      }
    });
  };

  const toggleMakeUp = (member: RosterMember, session: RosterSession) => {
    const key = `${member.userId}:${session.trackItemId}`;
    const current = state[key];
    if (current?.status !== "excused") return;
    const makeUp = !current.makeUp;
    setState((prev) => ({ ...prev, [key]: { ...current, makeUp } }));
    startTransition(async () => {
      const result = await markAttendance({
        cohortId,
        trackItemId: session.trackItemId,
        userId: member.userId,
        status: "excused",
        slot: null,
        makeUp,
      });
      if (!result.ok) {
        setState((prev) => ({ ...prev, [key]: current }));
        setError(result.message);
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Tap a cell to cycle: blank → attended → absent → excused. An excused
        member only counts toward their sessions gate if they made it up
        elsewhere - tick “made up” to record that.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Member
              </th>
              {sessions.map((session) => (
                <th key={session.trackItemId} className="px-3 py-2 text-left font-medium">
                  <span className="text-foreground">{session.title}</span>
                  {session.slotDates.length > 1 ? (
                    <span className="mt-1 flex gap-1">
                      {session.slotDates.map((date, i) => (
                        <button
                          key={date}
                          type="button"
                          onClick={() =>
                            setSlotBySession((prev) => ({
                              ...prev,
                              [session.trackItemId]: i + 1,
                            }))
                          }
                          className={cn(
                            "rounded border px-1.5 py-0.5 text-3xs",
                            (slotBySession[session.trackItemId] ?? 1) === i + 1
                              ? "border-primary bg-secondary text-secondary-foreground"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          Slot {i + 1}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-3xs font-normal text-muted-foreground">
                      {session.slotDates[0] ?? "no date set"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.cohortMemberId} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-foreground">{member.displayName}</td>
                {sessions.map((session) => {
                  const key = `${member.userId}:${session.trackItemId}`;
                  const cell = state[key] ?? { status: null, makeUp: false };
                  const style = cell.status ? CELL[cell.status] : null;
                  return (
                    <td key={session.trackItemId} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cycle(member, session)}
                          aria-label={`${member.displayName}, ${session.title}: ${style?.label ?? "not marked"}`}
                          className="inline-flex min-w-[5.5rem] items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs transition hover:border-primary/40"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              style?.dot ?? "bg-muted-foreground/30",
                            )}
                          />
                          {style?.label ?? "Not marked"}
                        </button>
                        {cell.status === "excused" && (
                          <label className="inline-flex items-center gap-1 text-3xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={cell.makeUp}
                              onChange={() => toggleMakeUp(member, session)}
                            />
                            made up
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
