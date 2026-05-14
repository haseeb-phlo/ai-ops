function gbp(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtMinutes(v: number): string {
  return `${Math.round(v).toLocaleString()} min`;
}

/**
 * "Projected since logged" rail. Each value is each initiative's weekly
 * run-rate multiplied by the number of weeks elapsed since it was logged,
 * summed across the portfolio (retired included). It's a model, not a
 * measurement - the headline weekly tiles are the live read-out.
 */
export function AllTimeRail({
  minutes,
  gbpSaved,
  revenue,
  interventionCount,
}: {
  minutes: number;
  gbpSaved: number;
  revenue: number;
  interventionCount: number;
}) {
  if (interventionCount === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Projected since logged
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          weekly run-rate × weeks elapsed, across {interventionCount}{" "}
          {interventionCount === 1 ? "AI initiative" : "AI initiatives"} (incl.
          retired)
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Projected time saved" value={fmtMinutes(minutes)} />
        <Tile label="Projected cost saved" value={gbp(gbpSaved)} />
        <Tile label="Projected revenue" value={gbp(revenue)} />
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
