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
  workflow: "bg-muted-foreground",
  step: "bg-amber-500",
  intervention: "bg-blue-500",
};

export function AuditLog({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Audit log
        </h2>
        <p className="text-xs text-muted-foreground">
          Last 100 edits across workflows, steps, and AI initiative status
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
                className="text-center text-xs text-muted-foreground"
              >
                No changes recorded.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell
                  className="whitespace-nowrap text-xs text-muted-foreground"
                  title={new Date(r.when).toLocaleString()}
                >
                  {relativeTime(r.when)}
                </TableCell>
                <TableCell className="text-xs text-foreground">{r.who}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${KIND_DOT[r.kind]}`}
                    />
                    {r.kind}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-medium text-foreground">
                  {r.target}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.field}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <span className="text-muted-foreground">{trim(r.oldValue)}</span>
                  <span className="px-1 text-muted-foreground/60">→</span>
                  <span className="text-foreground">{trim(r.newValue)}</span>
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
