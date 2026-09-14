"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  resetPreview,
  startPreview,
  type PreviewState,
} from "../_actions/preview";

/**
 * Walk the programme as a member would.
 *
 * Enrols you for real, in a cohort marked as test, backdated so nothing is
 * locked. Every screen is the real screen and every write is a real write -
 * there is no preview branch in the member code, because a preview that runs
 * different code proves nothing about the thing being previewed.
 */
export function PreviewPanel({
  hasPreview,
  previewCohortId,
}: {
  hasPreview: boolean;
  previewCohortId: string | null;
}) {
  const [startState, start, starting] = useActionState<PreviewState, FormData>(
    startPreview,
    { kind: "idle" },
  );
  const [resetState, reset, resetting] = useActionState<PreviewState, FormData>(
    resetPreview,
    { kind: "idle" },
  );
  const state = resetState.kind === "idle" ? startState : resetState;
  const active = hasPreview || startState.kind === "started";

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Try as a member
      </h3>
      <p className="mt-1 text-xs leading-normal text-body-foreground">
        Puts you in your own private run of the programme, backdated so nothing
        is locked. It is a real enrolment on real screens, so you see exactly
        what a member sees. It is marked as test data, so it stays out of every
        report and every notification, and it does not stop you joining a real
        cohort later.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!active ? (
          <form action={start}>
            <Button type="submit" disabled={starting}>
              <PlayIcon aria-hidden />
              {starting ? "Setting up..." : "Start a preview run"}
            </Button>
          </form>
        ) : (
          <>
            <Link
              href={
                previewCohortId
                  ? `/learn/track?cohort=${previewCohortId}`
                  : "/learn/track"
              }
              className={cn(buttonVariants())}
            >
              Open your run
            </Link>
            <form action={reset}>
              <Button type="submit" variant="outline" size="sm" disabled={resetting}>
                <RotateCcwIcon aria-hidden />
                {resetting ? "Clearing..." : "Start again"}
              </Button>
            </form>
          </>
        )}
      </div>

      {state.kind === "error" && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === "reset" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Cleared. Your run starts again from the top.
        </p>
      )}

      {active && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-normal text-muted-foreground">
          Starting again wipes this run&apos;s progress, submissions and quiz
          attempts, and the check-in if it was taken here. A check-in that
          belongs to a real cohort is left alone - it is your actual baseline,
          not sandbox data. It never touches anyone else&apos;s rows, and never
          an imported May response.
        </p>
      )}
    </section>
  );
}
