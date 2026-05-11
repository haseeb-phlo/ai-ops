function gbp(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtMinutes(v: number): string {
  return `${Math.round(v).toLocaleString()} min`;
}

/**
 * "Banked since launch" rail. Each value is the cumulative total since the
 * first intervention was logged - weekly run-rate × weeks-active per
 * intervention, summed across the whole portfolio (retired included). So
 * the headline weekly tiles answer "what's accruing right now?" while this
 * rail answers "how much has been banked, total, ever?".
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
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          All time, since launch
        </h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          across {interventionCount}{" "}
          {interventionCount === 1 ? "initiative" : "initiatives"} (incl.
          retired)
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Total time saved" value={fmtMinutes(minutes)} />
        <Tile label="Total cost saved" value={gbp(gbpSaved)} />
        <Tile label="Total revenue generated" value={gbp(revenue)} />
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
    </div>
  );
}
