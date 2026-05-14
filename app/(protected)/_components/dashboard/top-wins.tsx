import Link from "next/link";

export type Win = {
  id: string;
  name: string;
  team: string | null;
  weeklyGbp: number;
  weeklyMinutes: number;
  recipients: number;
  adoption: "daily" | "weekly" | "occasional" | "abandoned" | null;
};

const ADOPTION_DOT: Record<NonNullable<Win["adoption"]>, string> = {
  daily: "bg-emerald-500",
  weekly: "bg-emerald-400",
  occasional: "bg-amber-500",
  abandoned: "bg-red-500",
};

const ADOPTION_LABEL: Record<NonNullable<Win["adoption"]>, string> = {
  daily: "Daily",
  weekly: "Weekly",
  occasional: "Occasional",
  abandoned: "Abandoned",
};

function gbp(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtMinutes(v: number): string {
  return `${Math.round(v).toLocaleString()} min`;
}

/**
 * Top 5 wins on the home dashboard. Ranks active interventions by weekly
 * £ saved + revenue generated, falling back to minutes saved when the
 * financial signal is zero. Designed for leadership ROI conversations -
 * "which AI bets are paying off most" answered in five lines.
 *
 * Hidden when there's nothing to rank (no interventions yet, or all zero
 * impact) so the dashboard stays clean for new orgs.
 */
export function TopWins({ wins }: { wins: Win[] }) {
  if (wins.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Top wins
        </h2>
        <span className="text-xs text-muted-foreground">
          Ranked by weekly impact
        </span>
      </div>
      <ol className="divide-y divide-border">
        {wins.map((w, i) => (
          <li key={w.id} className="px-4 py-3">
            <Link
              href={`/interventions/${w.id}`}
              className="group flex items-start justify-between gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                    {w.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {w.team && <span>{w.team}</span>}
                    {w.team && <span aria-hidden>·</span>}
                    <span className="tabular-nums">
                      {w.recipients}{" "}
                      {w.recipients === 1 ? "recipient" : "recipients"}
                    </span>
                    {w.adoption && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full ${ADOPTION_DOT[w.adoption]}`}
                          />
                          {ADOPTION_LABEL[w.adoption]}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {w.weeklyGbp !== 0
                    ? `${gbp(w.weeklyGbp)} / wk`
                    : `${fmtMinutes(w.weeklyMinutes)} / wk`}
                </p>
                {w.weeklyGbp !== 0 && w.weeklyMinutes !== 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    + {fmtMinutes(w.weeklyMinutes)} / wk
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
