import { CheckIcon } from "lucide-react";

export function YourProgress({
  completed,
  watched,
  total,
}: {
  completed: number;
  watched: number;
  total: number;
}) {
  if (total === 0) return null;
  // Completion is the explicit "I've finished this" signal users tick, so
  // it's the headline metric. "Started" (auto-recorded on first play) is a
  // softer secondary line, always rendered so the two measures read as a
  // consistent pair instead of popping in and out.
  const pct = Math.round((completed / total) * 100);
  const done = completed === total;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Your progress
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {done && (
            <CheckIcon
              aria-hidden
              className="size-3.5 text-primary"
              strokeWidth={3}
            />
          )}
          {completed} of {total} completed
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Videos completed"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        {watched} started
      </p>
    </div>
  );
}
