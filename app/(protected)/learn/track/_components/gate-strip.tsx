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
 *
 * The Shared gate still gets a sentence underneath it, but it is now a
 * different sentence. It used to list the alternative routes to five,
 * because the arithmetic was substitution and "3/5" could not say whether
 * the shorter path was another example or the capstone. Every source adds
 * now, so the only thing left to say is where to put the next one - and that
 * is worth saying, because the Task link box is further down the page than
 * this chip and nothing else connects the two.
 */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five"];
export function GateStrip({
  gates,
  rag,
  g3Remaining,
  className,
}: {
  gates: GateSet;
  rag: ProgrammeRagStatus;
  /** Pieces of work left to clear the Shared gate. Zero once it has passed. */
  g3Remaining: number;
  className?: string;
}) {
  const ragStyle = PROGRAMME_RAG[rag];

  return (
    <section
      aria-label="Programme completion"
      className={cn(
        "rounded-lg border border-border bg-background p-4 sm:p-5",
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

      {g3Remaining > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Shared needs {COUNT_WORD[g3Remaining] ?? g3Remaining} more{" "}
          {g3Remaining === 1 ? "piece" : "pieces"} of work - paste the link
          under any day&apos;s Task.
        </p>
      )}
    </section>
  );
}
