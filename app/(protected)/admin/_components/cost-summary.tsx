import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gbp } from "@/lib/format";

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

/** "2026-06" → "Jun", or "Jun 26" when the visible window crosses a year. */
function monthLabel(month: string, withYear: boolean): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return format(new Date(y, m - 1, 1), withYear ? "MMM yy" : "MMM");
}

export function CostSummary({ cost }: Props) {
  const months = collectMonths(cost);
  const crossesYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Includes failed and retired initiatives. We&apos;d rather see honest
        spend than flatter the active ones.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <CostCard
          title="By vendor"
          buckets={cost.byVendor}
          months={months}
          crossesYear={crossesYear}
        />
        <CostCard
          title="By initiative type"
          buckets={cost.byType}
          months={months}
          crossesYear={crossesYear}
        />
        <CostCard
          title="By team"
          buckets={cost.byTeam}
          months={months}
          crossesYear={crossesYear}
        />
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>
          Initiatives with multiple type tags count once per type, so type
          totals can exceed the overall total.
        </p>
        <p>— = no data for that month (which may differ from £0).</p>
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
  crossesYear,
}: {
  title: string;
  buckets: Bucket[];
  months: string[];
  crossesYear: boolean;
}) {
  const grandTotal = buckets.reduce((s, b) => s + b.total, 0);
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {gbp(grandTotal)}
        </span>
      </div>
      {buckets.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          No cost snapshots logged.
        </p>
      ) : (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bucket
              </TableHead>
              {months.map((m) => (
                <TableHead
                  key={m}
                  className="h-8 px-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {monthLabel(m, crossesYear)}
                </TableHead>
              ))}
              <TableHead className="h-8 px-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => {
              const monthMap = new Map(b.rows.map((r) => [r.month, r.spend]));
              return (
                <TableRow key={b.key}>
                  <TableCell className="px-3 py-1.5 font-medium text-foreground">
                    <span className="block max-w-40 truncate" title={b.key}>
                      {b.key}
                    </span>
                  </TableCell>
                  {months.map((m) => (
                    <TableCell
                      key={m}
                      className="px-2 py-1.5 text-right tabular-nums text-muted-foreground"
                    >
                      {monthMap.has(m) ? gbp(monthMap.get(m)!) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="px-3 py-1.5 text-right font-semibold tabular-nums text-foreground">
                    {gbp(b.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
