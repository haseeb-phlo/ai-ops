export type WorkflowMetrics = {
  time_baseline: number | null;
  time_current: number | null;
  cost_baseline: number | null;
  cost_current: number | null;
  people_baseline: number | null;
  people_current: number | null;
  errors_baseline: number | null;
  errors_current: number | null;
  revenue_baseline: number | null;
  revenue_current: number | null;
} | null;

type Direction = "lower-better" | "higher-better";

type TileSpec = {
  key: string;
  label: string;
  unit: string;
  direction: Direction;
  baseline: number | null;
  current: number | null;
};

export function MetricsStrip({ metrics }: { metrics: WorkflowMetrics }) {
  const tiles: TileSpec[] = [
    {
      key: "time",
      label: "Time",
      unit: "min",
      direction: "lower-better",
      baseline: metrics?.time_baseline ?? null,
      current: metrics?.time_current ?? null,
    },
    {
      key: "cost",
      label: "Cost",
      unit: "£",
      direction: "lower-better",
      baseline: metrics?.cost_baseline ?? null,
      current: metrics?.cost_current ?? null,
    },
    {
      key: "people",
      label: "People",
      unit: "",
      direction: "lower-better",
      baseline: metrics?.people_baseline ?? null,
      current: metrics?.people_current ?? null,
    },
    {
      key: "errors",
      label: "Errors",
      unit: "",
      direction: "lower-better",
      baseline: metrics?.errors_baseline ?? null,
      current: metrics?.errors_current ?? null,
    },
    {
      key: "revenue",
      label: "Revenue",
      unit: "£",
      direction: "higher-better",
      baseline: metrics?.revenue_baseline ?? null,
      current: metrics?.revenue_current ?? null,
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Tile key={tile.key} tile={tile} />
      ))}
    </section>
  );
}

function Tile({ tile }: { tile: TileSpec }) {
  const hasData = tile.current != null || tile.baseline != null;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {tile.label}
        </div>
        <div className="mt-2 text-sm text-zinc-400">No data yet</div>
      </div>
    );
  }

  const delta =
    tile.current != null && tile.baseline != null
      ? tile.current - tile.baseline
      : null;

  const deltaPct =
    delta != null && tile.baseline != null && tile.baseline !== 0
      ? (delta / Math.abs(tile.baseline)) * 100
      : null;

  let deltaColor = "text-zinc-500";
  if (delta != null && delta !== 0) {
    const isImprovement =
      tile.direction === "lower-better" ? delta < 0 : delta > 0;
    deltaColor = isImprovement ? "text-green-700" : "text-red-700";
  }

  const arrow = delta == null || delta === 0 ? "" : delta > 0 ? "▲" : "▼";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {tile.label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
        {format(tile.current, tile.unit)}
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-xs">
        <span className="text-zinc-400">
          baseline {format(tile.baseline, tile.unit)}
        </span>
        {delta != null && (
          <span className={`font-medium tabular-nums ${deltaColor}`}>
            {arrow} {formatDelta(delta, deltaPct, tile.unit)}
          </span>
        )}
      </div>
    </div>
  );
}

function format(value: number | null, unit: string): string {
  if (value == null) return "—";
  const formatted =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit === "£" ? `£${formatted}` : unit ? `${formatted} ${unit}` : formatted;
}

function formatDelta(
  delta: number,
  pct: number | null,
  unit: string,
): string {
  const sign = delta > 0 ? "+" : "";
  const abs = format(Math.abs(delta), unit);
  const pctStr =
    pct != null
      ? ` (${sign}${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%)`
      : "";
  return `${sign}${unit === "£" ? abs.replace("£", "£") : abs}${pctStr}`;
}
