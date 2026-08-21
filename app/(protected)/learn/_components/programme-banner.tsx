import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROGRAMME_RAG, type ProgrammeRagStatus } from "@/lib/status";

/**
 * The Core Programme strip at the top of /learn.
 *
 * Learn stays a browsable library; this is the one place that says "and you
 * also have a mandatory track running". Members not in a cohort see nothing.
 */
export function ProgrammeBanner({
  cohortName,
  completed,
  total,
  rag,
  outstandingCount,
}: {
  cohortName: string;
  completed: number;
  total: number;
  rag: ProgrammeRagStatus;
  outstandingCount: number;
}) {
  const ragStyle = PROGRAMME_RAG[rag];
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Link
      href="/learn/track"
      className="group flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background p-4 transition hover:border-primary/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Core Programme
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                ragStyle.dotClassName,
              )}
            />
            {ragStyle.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cohortName} ·{" "}
          <span className="tabular-nums">
            {completed}/{total}
          </span>{" "}
          daily items complete
          {outstandingCount > 0 && ` · ${outstandingCount} open`}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden w-40 sm:block" aria-hidden>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Open track
          <ArrowRightIcon
            className="size-4 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
