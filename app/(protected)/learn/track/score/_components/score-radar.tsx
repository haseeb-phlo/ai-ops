"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  CAPABILITY_AXIS_LABEL,
  CAPABILITY_QUESTION_IDS,
} from "@/lib/programme/questions";
import type { AxisScores } from "@/lib/programme/score";

/**
 * The seven-axis capability radar.
 *
 * Axis order is FIXED (Prompting → AI Ops) so the shape is comparable between
 * waves and between people; reordering would make every past screenshot lie.
 *
 * Two series at most: the current wave as a filled polygon in Phlo teal, and
 * the prior wave as a dashed outline when one exists. The chart does NO
 * arithmetic - scores arrive computed from the server.
 */
export function ScoreRadar({
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  current: AxisScores;
  previous?: AxisScores | null;
  currentLabel: string;
  previousLabel?: string | null;
}) {
  const data = CAPABILITY_QUESTION_IDS.map((qid) => ({
    axis: CAPABILITY_AXIS_LABEL[qid],
    current: current[qid] ?? 0,
    previous: previous?.[qid] ?? 0,
  }));

  const hasPrevious = previous != null && Object.keys(previous).length > 0;

  return (
    <div className="w-full">
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[0, 4]}
              tickCount={5}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
            />
            {hasPrevious && (
              <Radar
                name={previousLabel ?? "Previous"}
                dataKey="previous"
                stroke="var(--muted-foreground)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                fill="none"
              />
            )}
            <Radar
              name={currentLabel}
              dataKey="current"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="var(--primary)"
              fillOpacity={0.18}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* A hand-rolled legend: recharts' own would need a second colour token
          and doesn't communicate "dashed = earlier" as directly. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          {currentLabel}
        </span>
        {hasPrevious && previousLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: "var(--muted-foreground)" }}
            />
            {previousLabel}
          </span>
        )}
      </div>

      {/* The chart is decorative to a screen reader; the numbers are not. */}
      <table className="sr-only">
        <caption>Capability scores out of 4</caption>
        <thead>
          <tr>
            <th>Area</th>
            <th>{currentLabel}</th>
            {hasPrevious && <th>{previousLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.axis}>
              <th scope="row">{row.axis}</th>
              <td>{row.current}</td>
              {hasPrevious && <td>{row.previous}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
