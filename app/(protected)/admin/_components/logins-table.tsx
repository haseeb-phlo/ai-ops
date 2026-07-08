"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Time } from "@/components/ui/time";

export type LoginTableRow = {
  email: string;
  displayName: string | null;
  team: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
};

const DAY = 86_400_000;

function freshness(
  lastSignIn: string | null,
  now: number,
): { dot: string; label: string } {
  if (!lastSignIn)
    return { dot: "bg-muted-foreground/60", label: "Never signed in" };
  const age = (now - new Date(lastSignIn).getTime()) / DAY;
  if (age < 7)
    return { dot: "bg-emerald-500", label: "Signed in within the last 7 days" };
  if (age < 30)
    return { dot: "bg-amber-500", label: "Signed in within the last 30 days" };
  return {
    dot: "bg-muted-foreground",
    label: "Last sign-in more than 30 days ago",
  };
}

export function LoginsTable({ rows }: { rows: LoginTableRow[] }) {
  const [query, setQuery] = useState("");
  // Snapshot once per mount: freshness buckets are day-granular, so a stale
  // "now" within a session is invisible and keeps render pure.
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.displayName ?? "", r.team ?? "", r.email]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  return (
    <div>
      <div className="border-b border-border px-3 py-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by person, team, or email"
          aria-label="Filter sign-ins"
          className="h-7 w-full text-xs sm:w-64"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Status</span>
            </TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead className="text-right">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-xs text-muted-foreground"
              >
                {rows.length === 0
                  ? "No users found."
                  : "No people match the filter."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => {
              const { dot, label } = freshness(r.lastSignInAt, now);
              return (
                <TableRow key={r.email}>
                  <TableCell>
                    <span
                      className={`inline-block size-2 rounded-full ${dot}`}
                      aria-hidden
                    />
                    <span className="sr-only">{label}</span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    {r.displayName ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.team ? (
                      <Badge variant="outline">{r.team}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {r.lastSignInAt ? (
                      <Time iso={r.lastSignInAt} relative />
                    ) : (
                      "never"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {r.createdAt ? <Time iso={r.createdAt} /> : "-"}
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
