import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gbp, minutes } from "./format";

type Confidence = "high" | "medium" | "low";

type Row = {
  id: string;
  name: string;
  type: string | null;
  owner: string | null;
  vendor: string | null;
  confidence: Confidence;
  teams: string[];
  weightedMinutes: number | null;
  weightedGbp: number | null;
  minutesSavedPerWeek: number | null;
  rawGbpDelta: number | null;
};

const CONF_STYLE: Record<Confidence, string> = {
  high: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function LeagueTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Intervention league table
        </h2>
        <p className="text-xs text-zinc-500">
          Active interventions only, sorted by confidence-weighted minutes saved
          per week.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Intervention</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="text-right">Min/wk (weighted)</TableHead>
            <TableHead className="text-right">£/wk (weighted)</TableHead>
            <TableHead className="text-right">Raw cost Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-xs text-zinc-400"
              >
                No active interventions.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/interventions/${r.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.teams.length > 0 && (
                    <p className="text-[11px] text-zinc-500">
                      {r.teams.join(", ")}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  {r.type ?? "-"}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  {r.owner ?? "-"}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  {r.vendor ?? "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${CONF_STYLE[r.confidence]}`}
                  >
                    {r.confidence}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.weightedMinutes != null
                    ? minutes(r.weightedMinutes)
                    : r.minutesSavedPerWeek != null
                      ? `~${minutes(r.minutesSavedPerWeek)}`
                      : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.weightedGbp != null ? gbp(r.weightedGbp) : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-500">
                  {r.rawGbpDelta != null ? gbp(r.rawGbpDelta) : "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
