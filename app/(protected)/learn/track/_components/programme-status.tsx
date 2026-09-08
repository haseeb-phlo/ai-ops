import Link from "next/link";
import { format } from "date-fns";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
import type { StepsToGreen } from "@/lib/programme/next-steps";
import { PROGRAMME_OPEN_LABEL } from "@/lib/programme/working-days";

/**
 * Where you are, in one card.
 *
 * This replaces four stacked panels - a completion notice, the four gates, the
 * week-one checkpoint warning and a "ready for you" panel - that between them
 * said the same three things in different words. The worst of it was
 * arithmetic: the panel's progress bar was `gates.g1`, so "4/24" was printed
 * twice on one screen, once as a number and once as a bar, and a reader had to
 * work out they were the same fact.
 *
 * What each tier is for, and why it is the only place its fact appears:
 *
 * 1. **The headline** answers "what now" - an open count, or up to date, or
 *    finished. Completion is a state of this headline rather than a card of
 *    its own; a separate "you have completed the programme" panel above a
 *    panel reading "all fifteen days done" is one thought spent twice.
 * 2. **The gates** are the only numbers on the page. They read as "3/5" and
 *    not as bars on purpose: the numbers are small and exact, and a member
 *    needs to know how many more, not roughly how far. A filled track would
 *    re-encode a number already on screen, which is exactly the duplication
 *    the old progress bar was.
 * 3. **What to do next** is every outstanding thing in one list, in the order
 *    that matters: the week-one checkpoint first because it shuts week two,
 *    then the shortest route back to green, then where to file work for the
 *    Shared gate. Each was previously its own panel with its own heading, so
 *    the page had three answers to one question.
 *
 * The Shared line survives because it carries something no number can: the
 * Task link box is much further down the page than this card and nothing else
 * joins the two. It no longer repeats the count - the tile above has it.
 *
 * The aqua wash is kept for the two states where nothing is open, and the ink
 * now moves with it. The old panel washed the surface but left its eyebrow on
 * `muted-foreground`, a pairing the contrast test does not sanction on
 * `--secondary`.
 */

const COUNT_WORD = ["no", "one", "two", "three", "four", "five"];

/** One line of "what to do next": what to do, and why it is worth doing now. */
type NextAction = { key: string; title: string; why: string };

export function ProgrammeStatus({
  gates,
  rag,
  g3Remaining,
  openCount,
  nextOpensOn,
  nextOpensToday,
  isComplete,
  nextSteps,
  weekOneOutstanding,
  className,
}: {
  gates: GateSet;
  rag: ProgrammeRagStatus;
  /** Pieces of work left to clear the Shared gate. Zero once it has passed. */
  g3Remaining: number;
  /** Items unlocked and not finished. */
  openCount: number;
  /** When the next locked thing opens, if anything is still to come. */
  nextOpensOn: string | null;
  /** That date is today, so the only thing left to wait for is 7am. */
  nextOpensToday?: boolean;
  isComplete: boolean;
  /** The shortest route back to green. Empty when already there. */
  nextSteps: StepsToGreen;
  /** Week one's submissions still missing. Empty once the checkpoint clears. */
  weekOneOutstanding: readonly { id: string; title: string; dayIndex: number }[];
  className?: string;
}) {
  const ragStyle = PROGRAMME_RAG[rag];

  // Nothing open is a brand moment, not an absence - on a drip programme most
  // visits end with nothing to do, and a page that greys out on those visits
  // reads as broken.
  const onWash = openCount === 0;
  const ink = {
    strong: onWash ? "text-secondary-foreground" : "text-foreground",
    quiet: onWash ? "text-secondary-foreground/80" : "text-muted-foreground",
  };

  const headline = isComplete
    ? "You've completed the Core Programme"
    : openCount > 0
      ? `${openCount} thing${openCount === 1 ? "" : "s"} open`
      : "You're up to date";

  const blurb = isComplete
    ? "All four gates passed. Everything stays here if you want to go back over it."
    : openCount > 0
      ? "Most days take about ten minutes. Nothing expires, so pick them up whenever your shift allows."
      : nextOpensOn
        ? nextOpensToday
          ? `Nothing else to do. The next part opens at ${PROGRAMME_OPEN_LABEL} today.`
          : `Nothing else to do. The next part opens on ${format(
              new Date(`${nextOpensOn}T00:00:00`),
              "EEEE d MMMM",
            )}.`
        : "Nothing waiting on you.";

  const actions: NextAction[] = [];

  if (weekOneOutstanding.length > 0) {
    const named = weekOneOutstanding
      .map((i) => `${i.title} (day ${i.dayIndex})`)
      .join(" and ");
    const count = weekOneOutstanding.length;
    actions.push({
      key: "week-one",
      // Said up front rather than at the wall. Without it the first sign of
      // the checkpoint is week two failing to open on the Monday, by which
      // point the "before" sample it asks for has stopped being a before.
      title:
        count === 1
          ? "Submit one thing before week 2 opens"
          : `Submit ${COUNT_WORD[count] ?? count} things before week 2 opens`,
      why: `Week 2 stays shut until ${named} ${
        count === 1 ? "is" : "are"
      } in. You do not need them signed off - submitting is enough.`,
    });
  }

  if (nextSteps.reachable) {
    for (const step of nextSteps.steps) {
      actions.push({ key: step.key, title: step.title, why: step.why });
    }
  }

  if (g3Remaining > 0) {
    actions.push({
      key: "shared",
      title: "Paste a link under any day's Task",
      why: "Every link you file counts toward Shared, whatever the day.",
    });
  }

  return (
    <section
      aria-label="Where you are"
      className={cn(
        "rounded-lg border border-border p-4 sm:p-5",
        onWash ? "bg-secondary" : "bg-background",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2
            className={cn(
              "flex items-center gap-2 text-lg font-semibold tracking-tight",
              ink.strong,
            )}
          >
            {onWash && <CheckIcon className="size-5 shrink-0" aria-hidden />}
            {headline}
          </h2>
          <p className={cn("mt-0.5 max-w-prose text-xs", ink.quiet)}>{blurb}</p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {/* No status chip once the programme is finished: "On track" against
              a headline saying it is complete is a weaker word for the same
              thing. */}
          {!isComplete && (
            <span
              className={cn("inline-flex items-center gap-1.5 text-xs", ink.quiet)}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  ragStyle.dotClassName,
                )}
              />
              {ragStyle.label}
            </span>
          )}
          {openCount > 0 && (
            <Link href="#day-timeline" className={cn(buttonVariants())}>
              Pick up where you left off
            </Link>
          )}
        </div>
      </div>

      {/* Flat, on the card's own surface: four stat cells divided by hairlines
          rather than four bordered boxes inside a bordered box. The label is
          the shared eyebrow, so these read as the same kind of thing as every
          other stat label in both apps, and the divided grid is the same
          recipe as the dashboard's roadmap snapshot. The first cell drops its
          left padding so the numbers line up with the headline above them. */}
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-4 sm:gap-x-0 sm:gap-y-0 sm:divide-x sm:divide-border">
        {GATE_IDS.map((id) => {
          const gate = gates[id];
          const style = gate.passed
            ? PROGRAMME_GATE_PASSED
            : PROGRAMME_GATE_PENDING;
          return (
            <li
              key={id}
              title={GATE_DESCRIPTION[id]}
              className="sm:px-4 sm:first:pl-0 sm:last:pr-0"
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    style.dotClassName,
                  )}
                />
                <span
                  className={cn(
                    "text-3xs font-semibold uppercase tracking-[0.06em]",
                    ink.quiet,
                  )}
                >
                  {GATE_LABEL[id]}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-base tabular-nums",
                  ink.strong,
                )}
              >
                {gate.current}
                <span className={ink.quiet}>/{gate.target}</span>
              </p>
              <p className="sr-only">
                {GATE_DESCRIPTION[id]}. {style.label}.
              </p>
            </li>
          );
        })}
      </ul>

      {actions.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p
            className={cn(
              "text-3xs font-semibold uppercase tracking-[0.06em]",
              ink.quiet,
            )}
          >
            What to do next
          </p>
          <ul className="mt-2 space-y-2">
            {actions.map((action) => (
              <li key={action.key}>
                <p className={cn("text-xs font-medium", ink.strong)}>
                  {action.title}
                </p>
                <p className={cn("max-w-prose text-xs", ink.quiet)}>
                  {action.why}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
