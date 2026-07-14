import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SnapshotItem = {
  /** Prefixed id ("suggestion:…" / "initiative:…") so React keys never collide across the two tables. */
  id: string;
  title: string;
  href: string;
  /** Queue position - rendered for the Up next column only. */
  ordinal?: number;
};

const SHOWN = 4;

/**
 * Read-only roadmap glance for the dashboard: what's next, what's
 * underway, what just shipped. Each column caps at four rows with a
 * "+N more" overflow link; all actions live on the board. Dot colours
 * reuse the suggestion status palette (lib/status.ts) so a lane means the
 * same colour everywhere.
 */
export function RoadmapSnapshot({
  upNext,
  inProgress,
  shipped,
}: {
  upNext: SnapshotItem[];
  inProgress: SnapshotItem[];
  shipped: SnapshotItem[];
}) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Roadmap
        </h2>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View roadmap
          <ArrowRightIcon aria-hidden className="size-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SnapshotColumn
          label="Up next"
          items={upNext}
          dotClassName="bg-indigo-500"
          emptyText="Queue is empty."
        />
        <SnapshotColumn
          label="In progress"
          items={inProgress}
          dotClassName="bg-cyan-500"
          emptyText="Nothing underway."
        />
        <SnapshotColumn
          label="Recently shipped"
          items={shipped}
          dotClassName="bg-emerald-500"
          emptyText="Nothing shipped yet."
        />
      </div>
    </section>
  );
}

function SnapshotColumn({
  label,
  items,
  dotClassName,
  emptyText,
}: {
  label: string;
  items: SnapshotItem[];
  dotClassName: string;
  emptyText: string;
}) {
  const shown = items.slice(0, SHOWN);
  const overflow = items.length - shown.length;

  return (
    <div className="px-4 py-3">
      <p className="flex items-baseline gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 translate-y-px rounded-full", dotClassName)}
        />
        {label}
        <span className="font-normal tabular-nums normal-case">
          {items.length}
        </span>
      </p>
      {shown.length === 0 ? (
        <p className="mt-2.5 text-xs text-muted-foreground/70">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-baseline gap-1.5 py-0.5 text-sm text-foreground"
              >
                {item.ordinal !== undefined && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                    {item.ordinal}.
                  </span>
                )}
                <span className="truncate group-hover:underline">
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
          {overflow > 0 && (
            <li>
              <Link
                href="/roadmap"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                +{overflow} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
