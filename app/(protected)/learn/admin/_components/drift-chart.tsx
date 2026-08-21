"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The drift comparison as two bars.
 *
 * Two bars rather than anything cleverer because the whole point is a single
 * comparison: this much without the programme, this much with it. A grouped
 * before/after chart would put four numbers on screen to make one point, and a
 * reader would have to do the subtraction themselves.
 *
 * Colour here is data, not status, so it comes off the categorical ramp - the
 * design system allows a wash only where the colour IS the data, and a chart
 * is the example it gives.
 *
 * A negative programme bar renders exactly like a positive one, pointing the
 * other way. If three weeks of training underperformed three months of drift,
 * that is the single most important thing on the page.
 */
export function DriftChart({
  organic,
  programme,
}: {
  organic: number | null;
  programme: number | null;
}) {
  if (organic === null || programme === null) return null;

  const data = [
    { label: "Without training", value: organic, fill: "var(--chart-1)" },
    { label: "With the programme", value: programme, fill: "var(--chart-2)" },
  ];

  // Symmetric domain so a negative bar is not visually squashed against a
  // scale drawn only for positives.
  const magnitude = Math.max(0.5, ...data.map((d) => Math.abs(d.value)));
  const domain: [number, number] = [
    Math.min(0, -magnitude * 1.15),
    magnitude * 1.15,
  ];

  return (
    <div className="h-[132px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
          barCategoryGap={14}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={domain}
            hide
          />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={4} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => {
                const n = Number(v);
                return Number.isFinite(n)
                  ? `${n > 0 ? "+" : ""}${n.toFixed(2)}`
                  : "";
              }}
              style={{
                fill: "var(--foreground)",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Without training, capability changed by {organic.toFixed(2)} points out
        of 4. With the programme, it changed by {programme.toFixed(2)}.
      </p>
    </div>
  );
}
