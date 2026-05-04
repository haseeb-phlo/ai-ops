"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TYPES = [
  "tool",
  "training",
  "prompt",
  "agent",
  "automation",
  "process_change",
] as const;

const TYPE_COLOURS: Record<(typeof TYPES)[number], string> = {
  tool: "#2563eb",
  training: "#0891b2",
  prompt: "#7c3aed",
  agent: "#16a34a",
  automation: "#ea580c",
  process_change: "#a16207",
};

const TYPE_LABEL: Record<(typeof TYPES)[number], string> = {
  tool: "Tool",
  training: "Training",
  prompt: "Prompt",
  agent: "Agent",
  automation: "Automation",
  process_change: "Process change",
};

export function TeamTypeChart({
  data,
}: {
  data: ({ team: string } & Record<(typeof TYPES)[number], number>)[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="team"
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${Math.round(v)}m`}
          />
          <Tooltip
            cursor={{ fill: "#fafafa" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              `${Math.round(Number(value) || 0)} min`,
              TYPE_LABEL[String(name) as (typeof TYPES)[number]] ?? String(name),
            ]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) =>
              TYPE_LABEL[value as (typeof TYPES)[number]] ?? value
            }
          />
          {TYPES.map((t) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="minutes"
              fill={TYPE_COLOURS[t]}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
