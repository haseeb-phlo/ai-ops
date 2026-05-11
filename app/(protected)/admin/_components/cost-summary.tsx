import { gbp } from "./format";

type Bucket = {
  key: string;
  rows: { month: string; spend: number }[];
  total: number;
};

type Props = {
  cost: {
    byVendor: Bucket[];
    byType: Bucket[];
    byTeam: Bucket[];
  };
};

export function CostSummary({ cost }: Props) {
  const months = collectMonths(cost);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Includes failed and retired interventions. We&apos;d rather see honest
        spend than flatter the active ones.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CostCard title="By vendor" buckets={cost.byVendor} months={months} />
        <CostCard
          title="By initiative type"
          buckets={cost.byType}
          months={months}
        />
        <CostCard title="By team" buckets={cost.byTeam} months={months} />
      </div>
    </div>
  );
}

function collectMonths(cost: Props["cost"]): string[] {
  const set = new Set<string>();
  for (const bucket of [...cost.byVendor, ...cost.byType, ...cost.byTeam]) {
    for (const r of bucket.rows) set.add(r.month);
  }
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 6);
}

function CostCard({
  title,
  buckets,
  months,
}: {
  title: string;
  buckets: Bucket[];
  months: string[];
}) {
  const grandTotal = buckets.reduce((s, b) => s + b.total, 0);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-zinc-500">
          {gbp(grandTotal)}
        </span>
      </div>
      {buckets.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-zinc-400">
          No cost snapshots logged.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-1.5 font-medium">Bucket</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-1.5 text-right font-medium">
                  {m.slice(5)}
                </th>
              ))}
              <th className="px-3 py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {buckets.map((b) => {
              const monthMap = new Map(b.rows.map((r) => [r.month, r.spend]));
              return (
                <tr key={b.key}>
                  <td className="truncate px-3 py-1.5 font-medium text-zinc-900">
                    {b.key}
                  </td>
                  {months.map((m) => (
                    <td
                      key={m}
                      className="px-2 py-1.5 text-right tabular-nums text-zinc-600"
                    >
                      {monthMap.has(m) ? gbp(monthMap.get(m)!) : "-"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-zinc-900">
                    {gbp(b.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
