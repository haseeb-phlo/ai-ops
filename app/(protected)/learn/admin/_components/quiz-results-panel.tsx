import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatIsoDate } from "@/lib/programme/working-days";
import type {
  QuizColumn,
  QuizColumnSummary,
  QuizResultRow,
} from "@/lib/programme/quiz-results";

/**
 * The whole cohort's quiz standing, one row per member.
 *
 * Reads best score rather than latest, because best is what the programme
 * credits and what a retake cannot lower - so the number here is the same one
 * the member sees and the same one gate G4 reads.
 *
 * Three cell states, not two. A blank cell cannot distinguish "has not taken
 * the Week 3 quiz" from "the Week 3 quiz does not open for a fortnight", and
 * a column of blanks in week one reads as a cohort ignoring it rather than a
 * quiz nobody could have sat. The unopened state says the date instead.
 */
export function QuizResultsPanel({
  cohortName,
  cohortStatus,
  columns,
  rows,
  summaries,
}: {
  cohortName: string;
  cohortStatus: string;
  columns: QuizColumn[];
  rows: QuizResultRow[];
  summaries: QuizColumnSummary[];
}) {
  const openColumns = columns.filter((c) => c.opened).length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Quiz results
          </h3>
          <p className="text-3xs text-muted-foreground">
            {cohortName}
            {cohortStatus === "live" && " · live now"} ·{" "}
            {openColumns} of {columns.length} quiz
            {columns.length === 1 ? "" : "zes"} open so far
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {columns.map((column, i) => {
            const summary = summaries[i];
            return (
              <div
                key={column.trackItemId}
                className="rounded-md border border-border bg-background p-3"
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  {column.title}
                  {column.summative && (
                    <span className="rounded border border-border px-1 py-px text-3xs font-normal text-muted-foreground">
                      counts for G4
                    </span>
                  )}
                </p>
                {column.opened ? (
                  <>
                    <p className="mt-1 font-mono text-lg tabular-nums text-foreground">
                      {summary?.passed ?? 0}
                      <span className="text-sm text-muted-foreground">
                        /{rows.length}
                      </span>
                    </p>
                    <p className="mt-0.5 text-3xs leading-tight text-muted-foreground">
                      passed · {summary?.attempted ?? 0} attempted
                      {summary?.averageBest !== null &&
                        summary?.averageBest !== undefined &&
                        ` · avg best ${summary.averageBest.toFixed(1)}/${column.questionCount}`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 font-mono text-lg tabular-nums text-muted-foreground">
                      -
                    </p>
                    <p className="mt-0.5 text-3xs leading-tight text-muted-foreground">
                      opens {formatIsoDate(column.opensOn)}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            By member
          </h3>
          <p className="text-3xs text-muted-foreground">
            Best score per quiz. Open a name for every answer they gave.
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Member
                </th>
                {columns.map((column) => (
                  <th
                    key={column.trackItemId}
                    className="px-3 py-2 text-left font-medium"
                  >
                    <span className="text-foreground">{column.title}</span>
                    <span className="mt-0.5 block text-3xs font-normal text-muted-foreground">
                      {column.opened
                        ? `pass ${column.passMark}/${column.questionCount}`
                        : `opens ${formatIsoDate(column.opensOn)}`}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Passed
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.cohortMemberId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/learn/admin/quiz/${row.cohortMemberId}`}
                      className="font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary"
                    >
                      {row.displayName}
                    </Link>
                  </td>
                  {row.cells.map((cell, i) => {
                    const column = columns[i];
                    return (
                      <td
                        key={cell.trackItemId}
                        className="px-3 py-2 tabular-nums"
                      >
                        {cell.state === "unopened" ? (
                          <span className="text-3xs text-muted-foreground">
                            not open yet
                          </span>
                        ) : cell.state === "not-attempted" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30"
                            />
                            Not attempted
                          </span>
                        ) : (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                              <span
                                aria-hidden
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  cell.passed ? "bg-success" : "bg-destructive",
                                )}
                              />
                              <span className="font-mono">
                                {cell.bestScore}/{column.questionCount}
                              </span>
                              {cell.passed ? "passed" : "not passed"}
                            </span>
                            <span className="text-3xs text-muted-foreground">
                              {cell.attempts} attempt
                              {cell.attempts === 1 ? "" : "s"}
                              {cell.lastAttemptAt &&
                                ` · last ${formatIsoDate(cell.lastAttemptAt.slice(0, 10))}`}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-foreground">
                    {row.passedCount}
                    <span className="text-muted-foreground">
                      /{row.openedCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
