"use client";

import { useState, useTransition } from "react";
import { DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PROGRAMME_RAG, type ProgrammeRagStatus } from "@/lib/status";
import { GATE_DESCRIPTION, GATE_IDS, GATE_LABEL } from "@/lib/programme/gates";
import { exportWorkSamplePairs } from "../actions";

export type HeatmapMember = {
  cohortMemberId: string;
  displayName: string;
  rag: ProgrammeRagStatus;
  outstandingCount: number;
  dayState: Record<number, "complete" | "partial" | "none" | "locked">;
};

/** Day cells are dots, not coloured squares - the app's status grammar. */
const DAY_DOT: Record<string, string> = {
  complete: "bg-success",
  partial: "bg-cyan-500",
  none: "bg-muted-foreground/30",
  locked: "bg-transparent border border-border",
};

const DAY_LABEL: Record<string, string> = {
  complete: "complete",
  partial: "in progress",
  none: "not started",
  locked: "locked",
};

export function CohortDashboard({
  cohortId,
  members,
  dayIndexes,
  funnel,
  attendance,
}: {
  cohortId: string;
  members: HeatmapMember[];
  dayIndexes: number[];
  funnel: { total: number; perGate: Record<string, number>; complete: number };
  attendance: {
    title: string;
    attended: number;
    absent: number;
    excused: number;
    unmarked: number;
  }[];
}) {
  return (
    <div className="space-y-6">
      <GateFunnel funnel={funnel} />
      <Heatmap members={members} dayIndexes={dayIndexes} />
      <AttendanceSummary rows={attendance} />
      <ExportCard cohortId={cohortId} />
    </div>
  );
}

function GateFunnel({
  funnel,
}: {
  funnel: { total: number; perGate: Record<string, number>; complete: number };
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Gates
      </h3>
      {/* Counts, not a narrowing funnel: G1-G4 are independent conditions, so
          a later gate legitimately out-counting an earlier one is not a bug. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {GATE_IDS.map((id) => (
          <div key={id} className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-medium text-foreground">{GATE_LABEL[id]}</p>
            <p className="mt-1 font-mono text-lg tabular-nums text-foreground">
              {funnel.perGate[id] ?? 0}
              <span className="text-sm text-muted-foreground">
                /{funnel.total}
              </span>
            </p>
            <p className="mt-0.5 text-3xs leading-tight text-muted-foreground">
              {GATE_DESCRIPTION[id]}
            </p>
          </div>
        ))}
        <div className="rounded-md border border-primary/40 bg-secondary p-3">
          <p className="text-xs font-medium text-secondary-foreground">
            All four
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums text-secondary-foreground">
            {funnel.complete}
            <span className="text-sm opacity-70">/{funnel.total}</span>
          </p>
          <p className="mt-0.5 text-3xs leading-tight text-secondary-foreground/80">
            Certificate earned
          </p>
        </div>
      </div>
    </section>
  );
}

function Heatmap({
  members,
  dayIndexes,
}: {
  members: HeatmapMember[];
  dayIndexes: number[];
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Progress by day
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-3xs text-muted-foreground">
          {(["complete", "partial", "none", "locked"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span aria-hidden className={cn("size-1.5 rounded-full", DAY_DOT[k])} />
              {DAY_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                Member
              </th>
              {dayIndexes.map((d) => (
                <th
                  key={d}
                  className="px-1 py-1 text-center font-mono text-3xs font-normal tabular-nums text-muted-foreground"
                >
                  {d}
                </th>
              ))}
              <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                Open
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.cohortMemberId} className="border-t border-border">
                <td className="sticky left-0 bg-background px-2 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        PROGRAMME_RAG[m.rag].dotClassName,
                      )}
                      title={PROGRAMME_RAG[m.rag].label}
                    />
                    {m.displayName}
                  </span>
                </td>
                {dayIndexes.map((d) => {
                  const s = m.dayState[d] ?? "locked";
                  return (
                    <td key={d} className="px-1 py-1.5 text-center">
                      <span
                        className={cn("inline-block size-1.5 rounded-full", DAY_DOT[s])}
                        title={`Day ${d}: ${DAY_LABEL[s]}`}
                      />
                      <span className="sr-only">
                        Day {d} {DAY_LABEL[s]}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {m.outstandingCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AttendanceSummary({
  rows,
}: {
  rows: {
    title: string;
    attended: number;
    absent: number;
    excused: number;
    unmarked: number;
  }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Attendance
      </h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-left font-medium">Session</th>
            <th className="py-1 text-right font-medium">Attended</th>
            <th className="py-1 text-right font-medium">Absent</th>
            <th className="py-1 text-right font-medium">Excused</th>
            <th className="py-1 text-right font-medium">Unmarked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.title} className="border-t border-border">
              <td className="py-1.5 text-foreground">{r.title}</td>
              <td className="py-1.5 text-right tabular-nums">{r.attended}</td>
              <td className="py-1.5 text-right tabular-nums">{r.absent}</td>
              <td className="py-1.5 text-right tabular-nums">{r.excused}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {r.unmarked}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ExportCard({ cohortId }: { cohortId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const download = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportWorkSamplePairs(cohortId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Work samples for blind scoring
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Before/after pairs, keyed by a stable hash. No name, email or team -
        the scorer shouldn&apos;t be able to tell whose work they&apos;re
        reading, and the file leaves our control once it&apos;s downloaded.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={download}
        disabled={pending}
      >
        <DownloadIcon aria-hidden />
        {pending ? "Preparing…" : "Download CSV"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
