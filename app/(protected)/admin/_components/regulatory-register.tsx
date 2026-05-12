import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "./format";

type Step = {
  id: string;
  title: string;
  workflowId: string;
  workflowName: string;
  team: string | null;
};

type Event = {
  id: string;
  workflow_id: string | null;
  step_id: string | null;
  severity: "red" | "amber" | "green";
  summary: string;
  resolved_at: string | null;
  created_at: string;
};

type Props = {
  steps: Step[];
  events: Event[];
  unresolvedCount: number;
};

export function RegulatoryRegister({ steps, events, unresolvedCount }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_400px]">
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Red-flag steps
          </h2>
          <p className="text-xs text-muted-foreground">
            Workflow steps with regulatory_flag = red. {steps.length} total.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Step</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-xs text-muted-foreground"
                >
                  No flagged steps yet.
                </TableCell>
              </TableRow>
            ) : (
              steps.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">
                    {s.title}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workflows/${s.workflowId}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {s.workflowName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.team ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Regulatory events
          </h2>
          <p className="text-xs text-muted-foreground">
            {unresolvedCount} unresolved · {events.length} total
          </p>
        </div>
        <ol className="max-h-96 divide-y divide-border overflow-y-auto">
          {events.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No events recorded.
            </li>
          ) : (
            events.map((e) => (
              <li key={e.id} className="px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full ${
                      e.severity === "red"
                        ? "bg-red-500"
                        : e.severity === "amber"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{e.summary}</p>
                    <p className="text-muted-foreground">
                      {e.resolved_at
                        ? `resolved ${relativeTime(e.resolved_at)}`
                        : `open · raised ${relativeTime(e.created_at)}`}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}
