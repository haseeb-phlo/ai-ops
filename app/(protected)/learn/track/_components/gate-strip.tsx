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
  type G3Route,
  type GateSet,
} from "@/lib/programme/gates";

/**
 * The four completion gates, pinned above the timeline.
 *
 * Progress reads as "3/5" rather than a bar: the numbers are small and exact,
 * and a member needs to know how many more, not roughly how far.
 *
 * That exactness is also why the Shared gate gets a sentence underneath it.
 * Its arithmetic is substitution, not addition, so "3/5" is true and still
 * leaves a member unable to choose between a fourth example and the capstone.
 * The routes say what the number cannot; see g3Routes.
 */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five"];

function describeRoute(route: G3Route): string {
  const examples =
    route.examples === 1
      ? "one more signed example"
      : `${COUNT_WORD[route.examples] ?? route.examples} more signed examples`;

  if (!route.capstone) return examples;
  return route.examples === 0
    ? "the capstone on its own, which covers two"
    : `the capstone plus ${examples}`;
}
export function GateStrip({
  gates,
  rag,
  g3Routes,
  className,
}: {
  gates: GateSet;
  rag: ProgrammeRagStatus;
  /** Complete ways left to clear the Shared gate. Empty once it has passed. */
  g3Routes: G3Route[];
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

      {g3Routes.length > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Shared needs {describeRoute(g3Routes[0])}
          {g3Routes.length > 1 && <>, or {describeRoute(g3Routes[1])}</>}.
        </p>
      )}
    </section>
  );
}
