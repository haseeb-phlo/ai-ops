import { CheckIcon } from "lucide-react";

export function YourProgress({
  watched,
  total,
}: {
  watched: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((watched / total) * 100);
  const done = watched === total;

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
              className="size-3.5 text-emerald-600"
              strokeWidth={3}
            />
          )}
          {watched} of {total} watched
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={watched}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Videos watched"
      >
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
