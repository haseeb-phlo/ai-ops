"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Confidence = "high" | "medium" | "low";

type Row = {
  id: string;
  name: string;
  type: string | null;
  owner: string | null;
  confidence: Confidence;
  teams: string[];
  weightedMinutes: number | null;
  weightedGbp: number | null;
  rawMinutesDelta: number | null;
  rawGbpDelta: number | null;
};

type SortKey = "minutes" | "gbp" | "name";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-green-50 text-green-800 ring-green-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

function fmtMinutes(v: number | null): string {
  if (v == null) return "-";
  return `${Math.round(v).toLocaleString()} min`;
}

function fmtGbp(v: number | null): string {
  if (v == null) return "-";
  const sign = v < 0 ? "-" : "";
  return `${sign}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function deltaClass(v: number | null): string {
  if (v == null) return "text-zinc-400";
  if (v < 0) return "text-red-700";
  if (v > 0) return "text-zinc-900";
  return "text-zinc-500";
}

export function TopInterventions({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<SortKey>("minutes");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "minutes") {
      copy.sort(
        (a, b) =>
          Math.abs(b.weightedMinutes ?? 0) - Math.abs(a.weightedMinutes ?? 0),
      );
    } else if (sort === "gbp") {
      copy.sort(
        (a, b) => Math.abs(b.weightedGbp ?? 0) - Math.abs(a.weightedGbp ?? 0),
      );
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy.slice(0, 10);
  }, [rows, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-400">
        No measured interventions yet - once you log a snapshot, they&apos;ll
        rank here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-600">Sort by</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="minutes">Weighted minutes / week</option>
          <option value="gbp">Weighted £ / week</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Min/wk (weighted)</TableHead>
              <TableHead className="text-right">£/wk (weighted)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/interventions/${r.id}`}
                    className="text-zinc-900 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.owner && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {r.owner}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.type ? (
                    <Badge variant="secondary">{r.type.replace("_", " ")}</Badge>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-zinc-700">
                  {r.teams.length > 0 ? (
                    r.teams.join(", ")
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CONFIDENCE_STYLES[r.confidence]}`}
                  >
                    {r.confidence}
                  </span>
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${deltaClass(r.weightedMinutes)}`}
                >
                  {fmtMinutes(r.weightedMinutes)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${deltaClass(r.weightedGbp)}`}
                >
                  {fmtGbp(r.weightedGbp)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
