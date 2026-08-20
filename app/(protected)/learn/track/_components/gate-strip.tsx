import { cn } from "@/lib/utils";
import {
  PROGRAMME_GATE_PASSED,
  PROGRAMME_GATE_PENDING,
  PROGRAMME_RAG,
  type ProgrammeRagStatus,
} from "@/lib/status";
import {
  GATE_DESCRIPTION,
  GATE_IDS,
  GATE_LABEL,
  type GateSet,
} from "@/lib/programme/gates";

/**
 * The four completion gates, pinned above the timeline.
 *
 * Progress reads as "3/5" rather than a bar: the numbers are small and exact,
 * and a member needs to know how many more, not roughly how far.
 */
export function GateStrip({
  gates,
  rag,
  className,
}: {
  gates: GateSet;
  rag: ProgrammeRagStatus;
  className?: string;
}) {
  const ragStyle = PROGRAMME_RAG[rag];

  return (
    <section
      aria-label="Programme completion"
      className={cn(
        "rounded-lg border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Your four gates
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn("size-1.5 shrink-0 rounded-full", ragStyle.dotClassName)}
          />
          {ragStyle.label}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GATE_IDS.map((id) => {
          const gate = gates[id];
          const style = gate.passed
            ? PROGRAMME_GATE_PASSED
            : PROGRAMME_GATE_PENDING;
          return (
            <li
              key={id}
              className="rounded-md border border-border bg-background px-3 py-2.5"
              title={GATE_DESCRIPTION[id]}
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    style.dotClassName,
                  )}
                />
                <span className="text-xs font-medium text-foreground">
                  {GATE_LABEL[id]}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
                {gate.current}
                <span className="text-muted-foreground/60">/{gate.target}</span>
              </p>
              <p className="sr-only">
                {GATE_DESCRIPTION[id]}. {style.label}.
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
