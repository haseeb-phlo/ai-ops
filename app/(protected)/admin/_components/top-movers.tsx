import Link from "next/link";

type Mover = {
  workflowId: string;
  name: string;
  team: string | null;
  latest: number;
  prior: number;
  delta: number;
};

type Props = {
  improvers: Mover[];
  regressors: Mover[];
};

export function TopMovers({ improvers, regressors }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <MoverList
        title="Improvers"
        subtitle="Time per run dropped most week-on-week"
        rows={improvers}
        positive
      />
      <MoverList
        title="Regressors"
        subtitle="Time per run grew most week-on-week"
        rows={regressors}
      />
    </div>
  );
}

function MoverList({
  title,
  subtitle,
  rows,
  positive,
}: {
  title: string;
  subtitle: string;
  rows: Mover[];
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-zinc-400">
          Not enough history yet (need at least two weekly snapshots).
        </p>
      ) : (
        <ol className="divide-y divide-zinc-100">
          {rows.map((m) => {
            const pct =
              m.prior === 0 ? null : Math.round((m.delta / m.prior) * 100);
            const cls = positive ? "text-emerald-700" : "text-red-700";
            return (
              <li
                key={m.workflowId}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <Link
                    href={`/workflows/${m.workflowId}`}
                    className="block truncate font-medium text-zinc-900 hover:underline"
                  >
                    {m.name}
                  </Link>
                  {m.team && (
                    <p className="truncate text-zinc-500">{m.team}</p>
                  )}
                </div>
                <p className="tabular-nums text-zinc-500">
                  {Math.round(m.prior)} → {Math.round(m.latest)} min
                </p>
                <p className={`tabular-nums font-semibold ${cls}`}>
                  {m.delta > 0 ? "+" : ""}
                  {Math.round(m.delta)}
                  {pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
