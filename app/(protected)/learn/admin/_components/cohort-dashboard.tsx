"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
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

export type TaskLinkRow = {
  cohortMemberId: string;
  displayName: string;
  byDay: Record<number, string>;
};

export type WorkSampleRow = {
  cohortMemberId: string;
  displayName: string;
  preRef: string | null;
  postRef: string | null;
  preSubmittedAt: string | null;
  postSubmittedAt: string | null;
};

export function CohortDashboard({
  cohortId,
  members,
  dayIndexes,
  funnel,
  attendance,
  workSamples,
  taskLinks,
  taskDayIndexes,
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
  workSamples: WorkSampleRow[];
  taskLinks: TaskLinkRow[];
  taskDayIndexes: number[];
}) {
  return (
    <div className="space-y-6">
      <GateFunnel funnel={funnel} />
      <Heatmap members={members} dayIndexes={dayIndexes} />
      <AttendanceSummary rows={attendance} />
      <TaskLinkTable rows={taskLinks} dayIndexes={taskDayIndexes} />
      <WorkSampleTable rows={workSamples} />
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
            Programme complete
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

/**
 * Every member's Task link, day by day.
 *
 * The links are the only per-day evidence the programme collects. They are
 * NOT submissions: they never enter the sign-off queue, never reach the
 * gallery and are not reviewed, which is deliberate - fifteen days times a
 * cohort is not a review workload anyone would survive. That leaves them
 * readable nowhere, which is what this table fixes, on the same reasoning as
 * the work samples below: an admin cannot chase a gap they cannot see.
 *
 * Columns stop at the last day that has opened, so an empty cell always means
 * "nothing filed" rather than "not due yet".
 */
function TaskLinkTable({
  rows,
  dayIndexes,
}: {
  rows: TaskLinkRow[];
  dayIndexes: number[];
}) {
  const possible = rows.length * dayIndexes.length;
  const filed = rows.reduce(
    (total, row) =>
      total + dayIndexes.filter((day) => Boolean(row.byDay[day])).length,
    0,
  );

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Task links
        </h3>
        <span className="text-xs text-muted-foreground">
          {filed} of {possible} filed
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        What each person produced for each day&apos;s Task. Filed by the member
        on their own timeline, not reviewed and not part of sign-off - this is
        the record of who is actually doing the daily work.
      </p>

      {dayIndexes.length === 0 || rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {rows.length === 0
            ? "Nobody is enrolled on this cohort yet."
            : "No Task has opened yet."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted-foreground">
                  Member
                </th>
                {dayIndexes.map((day) => (
                  <th
                    key={day}
                    className="px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    <span className="font-mono text-3xs tabular-nums">
                      D{day}
                    </span>
                  </th>
                ))}
                <th className="py-2 pl-3 text-right font-medium text-muted-foreground">
                  Filed
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const count = dayIndexes.filter((day) =>
                  Boolean(row.byDay[day]),
                ).length;
                return (
                  <tr key={row.cohortMemberId} className="border-b border-border">
                    <td className="py-2 pr-3 whitespace-nowrap text-foreground">
                      {row.displayName}
                    </td>
                    {dayIndexes.map((day) => {
                      const url = row.byDay[day];
                      return (
                        <td key={day} className="px-2 py-2 text-center">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center text-foreground hover:text-primary"
                              aria-label={`Open ${row.displayName}'s day ${day} Task link`}
                            >
                              <ExternalLinkIcon className="size-3.5" aria-hidden />
                            </a>
                          ) : (
                            <span
                              className="text-muted-foreground/50"
                              aria-label={`${row.displayName} has filed nothing for day ${day}`}
                            >
                              &ndash;
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 text-right font-mono text-3xs tabular-nums text-muted-foreground">
                      {count}/{dayIndexes.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Who submitted what, with names on it.
 *
 * Deliberately NOT the same thing as the CSV below. That file is anonymised
 * because an external scorer must not know whose work they are reading; this
 * table exists because the person running the programme has to be able to
 * chase the people who have not submitted, and a hashed key cannot be chased.
 *
 * Work samples are private and self-approving, so they appear on no other
 * screen - not the sign-off queue, which only lists what needs a decision,
 * and not the gallery, which is approved public work. Without this the only
 * way to read them was the anonymised export.
 */
function WorkSampleTable({ rows }: { rows: WorkSampleRow[] }) {
  const submitted = rows.filter((r) => r.preRef).length;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Work samples
        </h3>
        <span className="text-xs text-muted-foreground">
          {submitted} of {rows.length} have submitted a before sample
        </span>
      </div>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Private to admins. These are the before/after pair the programme is
        measured on - the blind-scoring file below is the same links with the
        names taken off.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium text-muted-foreground">
                Member
              </th>
              <th className="py-2 pr-3 font-medium text-muted-foreground">
                Before (day 1)
              </th>
              <th className="py-2 font-medium text-muted-foreground">
                After (day 15)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohortMemberId} className="border-b border-border">
                <td className="py-2 pr-3 text-foreground">{row.displayName}</td>
                <td className="py-2 pr-3">
                  <SampleCell url={row.preRef} at={row.preSubmittedAt} />
                </td>
                <td className="py-2">
                  <SampleCell url={row.postRef} at={row.postSubmittedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nobody is enrolled on this cohort yet.
        </p>
      )}
    </section>
  );
}

function SampleCell({ url, at }: { url: string | null; at: string | null }) {
  if (!url) {
    return <span className="text-muted-foreground">Not submitted</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {/* Opens in a new tab: these are external links and losing the admin
          page mid-review is a nuisance. rel is set because target="_blank"
          without it hands the opened page a handle back to this one. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4"
      >
        Open
      </a>
      {at && (
        <span className="text-xs text-muted-foreground">
          {format(new Date(at), "d MMM")}
        </span>
      )}
    </span>
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
