import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "./format";

type Row = {
  id: string;
  when: string;
  who: string;
  kind: "workflow" | "step" | "intervention";
  target: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

const KIND_DOT: Record<Row["kind"], string> = {
  workflow: "bg-zinc-400",
  step: "bg-amber-500",
  intervention: "bg-blue-500",
};

export function AuditLog({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Audit log
        </h2>
        <p className="text-xs text-zinc-500">
          Last 100 edits across workflows, steps, and intervention status
          changes.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-xs text-zinc-400"
              >
                No changes recorded.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell
                  className="whitespace-nowrap text-xs text-zinc-500"
                  title={new Date(r.when).toLocaleString()}
                >
                  {relativeTime(r.when)}
                </TableCell>
                <TableCell className="text-xs text-zinc-700">{r.who}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${KIND_DOT[r.kind]}`}
                    />
                    {r.kind}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-medium text-zinc-900">
                  {r.target}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  {r.field}
                </TableCell>
                <TableCell className="text-xs text-zinc-600">
                  <span className="text-zinc-400">{trim(r.oldValue)}</span>
                  <span className="px-1 text-zinc-300">→</span>
                  <span className="text-zinc-900">{trim(r.newValue)}</span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function trim(v: string | null): string {
  if (v == null) return "∅";
  return v.length > 40 ? v.slice(0, 40) + "…" : v;
}
