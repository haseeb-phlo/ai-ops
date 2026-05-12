type Point = { date: string; value: number };

type Series = {
  label: string;
  points: Point[];
  format: (v: number) => string;
};

/**
 * 3-up trend strip on the home dashboard. Each card is a small SVG line
 * over the last 90 days for one of the headline metrics (minutes saved /
 * GBP saved / revenue generated). Inline SVG keeps the bundle empty and
 * the visual weight low; the strip's job is to answer "is it trending up
 * or flat?" at a glance, not to be a precise analytics surface.
 *
 * Hidden when there's no data for any series so first-time users don't
 * see flat zeroes - same empty-state pattern the other dashboard rails
 * use.
 */
export function TrendStrip({ series }: { series: Series[] }) {
  const hasAnyData = series.some((s) =>
    s.points.some((p) => p.value !== 0),
  );
  if (!hasAnyData) return null;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {series.map((s) => (
        <TrendCard key={s.label} series={s} />
      ))}
    </section>
  );
}

function TrendCard({ series }: { series: Series }) {
  const { points, label, format } = series;
  const last = points[points.length - 1]?.value ?? 0;
  const first = points[0]?.value ?? 0;
  const delta = last - first;
  const deltaPct =
    first === 0 ? null : Math.round((delta / Math.abs(first)) * 100);
  const deltaIsUp = delta > 0;
  const deltaIsDown = delta < 0;
  // Cumulative across the visible window: each weekly point is the as-of
  // rate at that week-end, so summing them is a Riemann approximation of
  // total impact "banked" over the 12-week window. Useful for ROI talks.
  const cumulative = points.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Sparkline points={points} className="mt-2 h-20 w-full" />
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm tabular-nums text-foreground">
          {format(last)}
        </span>
        <span
          className={`text-xs tabular-nums ${
            deltaIsUp
              ? "text-emerald-600"
              : deltaIsDown
                ? "text-red-600"
                : "text-muted-foreground"
          }`}
        >
          {deltaIsUp ? "+" : ""}
          {format(delta)}
          {deltaPct == null
            ? ""
            : ` (${deltaIsUp ? "+" : ""}${deltaPct}%)`}{" "}
          vs 90d ago
        </span>
      </div>
      <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground tabular-nums">
        <span className="text-muted-foreground">12-week cumulative · </span>
        <span className="font-medium text-foreground">{format(cumulative)}</span>
      </p>
    </div>
  );
}

function Sparkline({
  points,
  className,
}: {
  points: Point[];
  className?: string;
}) {
  const width = 280;
  const height = 80;
  const padding = 4;

  if (points.length === 0) {
    return <svg viewBox={`0 0 ${width} ${height}`} className={className} />;
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = padding + i * xStep;
    // Map value into chart space; flip y because SVG y grows downwards.
    const y = padding + (1 - (p.value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${(height - padding).toFixed(2)} L ${first.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend over ${points.length} weeks`}
    >
      {/* Baseline grid line at value=0 (or chart bottom if all positive) */}
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="rgb(228 228 231)"
        strokeWidth="1"
      />
      <path d={areaPath} fill="rgb(24 24 27 / 0.05)" />
      <path
        d={linePath}
        fill="none"
        stroke="rgb(24 24 27)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last-point dot to anchor the eye on "today's value". */}
      <circle
        cx={last.x}
        cy={last.y}
        r="2.5"
        fill="rgb(24 24 27)"
      />
    </svg>
  );
}
