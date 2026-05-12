"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { removeChampion } from "../_actions/champions";
import { relativeTime } from "./format";

type Row = {
  id: string;
  team: string;
  displayName: string;
  lastCheckIn: string | null;
};

const TRAFFIC_STYLE = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
} as const;

type Traffic = keyof typeof TRAFFIC_STYLE;

function trafficFor(lastCheckIn: string | null): {
  traffic: Traffic;
  ageDays: number | null;
} {
  if (!lastCheckIn) return { traffic: "red", ageDays: null };
  const age = (Date.now() - new Date(lastCheckIn).getTime()) / 86_400_000;
  const traffic: Traffic = age < 14 ? "green" : age < 30 ? "amber" : "red";
  return { traffic, ageDays: Math.floor(age) };
}

/**
 * Admin "all champions" surface: every registered champion, their freshness,
 * and a Remove button per row. The other half of champion management (adding
 * a new champion to a team) lives in ChampionsManager above this; together
 * they're the single source of truth, so remove flows aren't buried behind a
 * team-select on the team page.
 */
export function ChampionsFreshness({ rows }: { rows: Row[] }) {
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
            <TableHead className="w-8" />
            <TableHead>Team</TableHead>
            <TableHead>Champion</TableHead>
            <TableHead>Last check-in</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead className="w-24" />
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
              const { traffic, ageDays } = trafficFor(r.lastCheckIn);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <span
                      className={`inline-block size-2 rounded-full ${TRAFFIC_STYLE[traffic]}`}
                      aria-label={traffic}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    {r.team}
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {r.displayName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.lastCheckIn
                      ? relativeTime(r.lastCheckIn)
                      : "never checked in"}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {ageDays == null ? "-" : `${ageDays}d`}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={removeChampion}>
                      <input type="hidden" name="champion_id" value={r.id} />
                      <input type="hidden" name="team" value={r.team} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="text-red-700"
                      >
                        Remove
                      </Button>
                    </form>
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
