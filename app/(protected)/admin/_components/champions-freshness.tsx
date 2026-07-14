"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Time } from "@/components/ui/time";
import { removeChampion } from "../_actions/champions";

type Row = {
  id: string;
  team: string;
  displayName: string;
  lastCheckIn: string | null;
};

export const TRAFFIC_STYLE = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
} as const;

type Traffic = keyof typeof TRAFFIC_STYLE;

export function trafficFor(lastCheckIn: string | null): {
  traffic: Traffic;
  ageDays: number | null;
  label: string;
} {
  if (!lastCheckIn)
    return { traffic: "red", ageDays: null, label: "Never checked in" };
  const age = (Date.now() - new Date(lastCheckIn).getTime()) / 86_400_000;
  const traffic: Traffic = age < 14 ? "green" : age < 30 ? "amber" : "red";
  const label =
    traffic === "green"
      ? "Checked in within the last 14 days"
      : traffic === "amber"
        ? "Checked in within the last 30 days"
        : "No check-in for more than 30 days";
  return { traffic, ageDays: Math.floor(age), label };
}

/**
 * Admin "all champions" surface: every registered champion, their freshness,
 * and a Remove button per row. The other half of champion management (adding
 * a new champion to a team) lives in ChampionsManager above this; together
 * they're the single source of truth, so remove flows aren't buried behind a
 * team-select on the team page.
 */
export function ChampionsFreshness({ rows }: { rows: Row[] }) {
  // Two-step confirm: the first click arms the row, the second actually
  // removes. Pending + errors are tracked per row so one failing remove
  // doesn't block or hide the others.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  function handleRemove(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPendingId(id);
    startTransition(async () => {
      const result = await removeChampion(id);
      setPendingId(null);
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, [id]: result.error }));
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          All champions
        </h2>
        <p className="text-xs text-muted-foreground">
          Green &lt;14d · amber &lt;30d · red &gt;30d since last check-in.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Status</span>
            </TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Champion</TableHead>
            <TableHead>Last check-in</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-xs text-muted-foreground"
              >
                No champions registered yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const { traffic, ageDays, label } = trafficFor(r.lastCheckIn);
              const confirming = confirmId === r.id;
              const removing = pendingId === r.id;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <span
                      className={`inline-block size-2 rounded-full ${TRAFFIC_STYLE[traffic]}`}
                      aria-label={label}
                      role="img"
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{r.team}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {r.displayName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.lastCheckIn ? (
                      <Time iso={r.lastCheckIn} relative />
                    ) : (
                      "never checked in"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {ageDays == null ? "-" : `${ageDays}d`}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {confirming && !removing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant={confirming ? "destructive" : "outline"}
                          size="sm"
                          loading={removing}
                          className={confirming ? undefined : "text-destructive"}
                          onClick={() => handleRemove(r.id)}
                        >
                          {removing
                            ? "Removing…"
                            : confirming
                              ? "Confirm remove?"
                              : "Remove"}
                        </Button>
                      </div>
                      {errors[r.id] && (
                        <span role="alert" className="text-xs text-destructive">
                          {errors[r.id]}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
