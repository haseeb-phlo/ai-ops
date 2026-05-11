import Link from "next/link";
import { format } from "date-fns";

export type StreamItem =
  | {
      kind: "intervention";
      id: string;
      name: string;
      status: string | null;
      at: string;
    }
  | {
      kind: "regulatory";
      id: string;
      summary: string;
      severity: "red" | "amber" | "green";
      at: string;
      workflowId: string | null;
    }
  | {
      kind: "note";
      id: string;
      team: string;
      body: string;
      at: string;
      target_type: "workflow" | "intervention";
      target_id: string;
    };

export function ActivityStream({ items }: { items: StreamItem[] }) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-zinc-400">
        Quiet week. Nothing new logged.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((it) => (
        <li key={`${it.kind}:${it.id}`} className="px-4 py-3 text-sm">
          {it.kind === "intervention" && (
            <Row
              icon={<Glyph kind="intervention" />}
              title={
                <Link
                  href={`/interventions/${it.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {it.name}
                </Link>
              }
              meta={[
                "New AI initiative",
                it.status ? `status: ${it.status}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "regulatory" && (
            <Row
              icon={<RegDot severity={it.severity} />}
              title={
                it.workflowId ? (
                  <Link
                    href={`/workflows/${it.workflowId}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {it.summary}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900">
                    {it.summary}
                  </span>
                )
              }
              meta="Regulatory event"
              at={it.at}
            />
          )}
          {it.kind === "note" && (
            <Row
              icon={<Glyph kind="note" />}
              title={
                <Link
                  href={
                    it.target_type === "workflow"
                      ? `/workflows/${it.target_id}`
                      : `/interventions/${it.target_id}`
                  }
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {it.team} champion note
                </Link>
              }
              meta={truncate(it.body, 120)}
              at={it.at}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({
  icon,
  title,
  meta,
  at,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  meta: string;
  at: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title}
          <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
            {format(new Date(at), "d MMM")}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{meta}</p>
      </div>
    </div>
  );
}

function Glyph({ kind }: { kind: "intervention" | "note" }) {
  if (kind === "intervention") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
        +
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center justify-center rounded-full bg-amber-100 px-1.5 font-mono text-[8px] font-semibold leading-none tracking-tight text-amber-700">
      AI
    </span>
  );
}

function RegDot({ severity }: { severity: "red" | "amber" | "green" }) {
  const cls =
    severity === "red"
      ? "bg-red-500"
      : severity === "amber"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <span className="mt-1.5 inline-block size-2.5 rounded-full" aria-hidden>
      <span className={`block h-full w-full rounded-full ${cls}`} />
    </span>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
