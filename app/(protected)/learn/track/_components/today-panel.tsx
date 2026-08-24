import Link from "next/link";
import { format } from "date-fns";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { StepsToGreen } from "@/lib/programme/next-steps";

/**
 * The one panel that answers "what do I do now".
 *
 * A fifteen-day timeline rendered as fifteen equal rows makes the reader do the
 * scanning: which day am I on, what is left, is any of it urgent. That is work
 * the page should have done. So the open work is lifted out and stated once, at
 * the top, and the timeline below becomes reference rather than the interface.
 *
 * It also carries the way back to green when someone has drifted. A status
 * that only names a colour is a judgement; the same numbers turned around are
 * a short list of things to do, and the list is almost always far shorter than
 * the open count because green tolerates one loose end. See next-steps.ts.
 *
 * The "up to date" state is deliberately a first-class outcome and not an
 * absence. On a drip programme most visits end with nothing to do, and a page
 * that just shows a wall of locked days on those visits reads as broken - which
 * is exactly what it was doing before.
 */
export function TodayPanel({
  openCount,
  nextOpensOn,
  completedCount,
  totalCount,
  awaitingVideoCount,
  isComplete,
  nextSteps,
}: {
  /** Items unlocked and not finished. */
  openCount: number;
  /** When the next locked thing opens, if anything is still to come. */
  nextOpensOn: string | null;
  completedCount: number;
  totalCount: number;
  awaitingVideoCount: number;
  isComplete: boolean;
  /** The shortest route back to green. Empty when already there. */
  nextSteps: StepsToGreen;
}) {
  const pct =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <section
      className={cn(
        "rounded-lg border p-5",
        openCount > 0
          ? "border-border bg-background"
          : "border-border bg-secondary text-secondary-foreground",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {openCount > 0 ? "Ready for you" : "Where you are"}
          </p>

          {openCount > 0 ? (
            <>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                {openCount} thing{openCount === 1 ? "" : "s"} open
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Most days take about ten minutes. Nothing expires, so pick them
                up whenever your shift allows.
              </p>
            </>
          ) : isComplete ? (
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <CheckIcon className="size-5" aria-hidden />
              All fifteen days done
            </h2>
          ) : (
            <>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
                <CheckIcon className="size-5" aria-hidden />
                You&apos;re up to date
              </h2>
              <p className="mt-0.5 text-xs text-secondary-foreground/80">
                {nextOpensOn
                  ? `Nothing else to do. The next part opens on ${format(new Date(`${nextOpensOn}T00:00:00`), "EEEE d MMMM")}.`
                  : "Nothing waiting on you."}
              </p>
            </>
          )}
        </div>

        {openCount > 0 && (
          <Link href="#day-timeline" className={cn(buttonVariants())}>
            Pick up where you left off
          </Link>
        )}
      </div>

      {/* Progress reads as a count first and a bar second: "9 of 16" is what
          someone wants to know, the bar is only there to make it glanceable. */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label="Daily items complete"
        >
          <div
            className="h-full rounded-full bg-primary transition-colors"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
      </div>

      {!nextSteps.reachable && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground">
            A live session has passed without an attendance mark
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ask your lead about a make-up session. That is the one thing that
            reopens it, and nothing else on your track is affected.
          </p>
        </div>
      )}

      {nextSteps.reachable && nextSteps.steps.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground">
            {nextSteps.steps.length === 1 ? "One thing" : "Two things"} would
            move you back to green
          </p>
          <ul className="mt-2 space-y-2">
            {nextSteps.steps.map((step) => (
              <li key={step.key}>
                <p className="text-xs font-medium text-foreground">
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {awaitingVideoCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {awaitingVideoCount} video{awaitingVideoCount === 1 ? " is" : "s are"}{" "}
          still being recorded. They will not count against you.
        </p>
      )}
    </section>
  );
}
