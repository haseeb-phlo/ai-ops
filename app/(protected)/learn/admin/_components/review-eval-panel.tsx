"use client";

import { useActionState } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { runEval, type EvalRunState } from "../_actions/review-eval";

/**
 * Check the automatic reviewer against a fixed set of submissions.
 *
 * Eight cases with known right answers - a clear pass, a one-liner, a
 * capstone, an attempt to instruct the reviewer, a claim that lives in a file
 * the model cannot open, clinical work, a vague task and a plain-but-usable
 * prompt. Running here rather than on a laptop means it checks the deployed
 * configuration, so a wrong model id or a missing credential shows up as
 * eight errors rather than as a quiet queue.
 */
export function ReviewEvalPanel({ configuration }: { configuration: string }) {
  const [state, action, pending] = useActionState<EvalRunState, FormData>(runEval, {
    kind: "idle",
  });

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        Check the automatic reviewer
      </h3>
      <p className="mt-1 text-xs leading-normal text-body-foreground">
        Runs eight submissions with known right answers through the real
        reviewer: a clear pass, a one-liner, a capstone, an attempt to instruct
        the reviewer, a claim it cannot verify, clinical work, a vague task and
        a plain but usable prompt. Run it after any change to the prompt or the
        model, and once before a cohort starts.
      </p>
      <Eyebrow as="p" className="mt-1">
        {configuration}
      </Eyebrow>

      <form action={action} className="mt-3">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <FlaskConicalIcon aria-hidden />
          {pending ? "Running, about 30 seconds..." : "Run the check"}
        </Button>
      </form>

      {state.kind === "error" && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === "done" && (
        <div className="mt-3 space-y-3">
          <div
            className={cn(
              "rounded-md border border-border bg-background px-3 py-2 text-xs",
              "border-l-2",
              state.passes ? "border-l-success" : "border-l-destructive",
            )}
          >
            <p className="font-medium text-foreground">
              {state.passes
                ? "Behaving as it should"
                : "Not safe to leave running unattended"}
            </p>
            <p className="mt-0.5 text-muted-foreground tabular-nums">
              {state.agreed} of {state.total} agreed ·{" "}
              {state.falseApprovals} approved that should have been flagged ·{" "}
              {state.falseFlags} flagged that should have passed ·{" "}
              {state.total - state.styleClean} with style problems
              {state.errors > 0 && ` · ${state.errors} errored`}
            </p>
            {state.falseApprovals > 0 && (
              <p className="mt-1 text-foreground">
                An approval that should have been flagged is a gate that did
                not hold, and nobody finds out. Switch the cohort to
                people-only review until this is fixed.
              </p>
            )}
          </div>

          <ul className="space-y-1.5">
            {state.rows.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      row.falseApproval
                        ? "bg-destructive"
                        : row.agreed
                          ? "bg-success"
                          : "bg-warning",
                    )}
                    aria-hidden
                  />
                  <span className="font-medium text-foreground">{row.id}</span>
                  <span className="text-muted-foreground">
                    wanted {row.expected}, got {row.actual}
                  </span>
                </div>
                {row.reasons.length > 0 && (
                  <p className="mt-0.5 pl-3.5 text-muted-foreground">
                    {row.reasons.join(", ")}
                  </p>
                )}
                {row.styleViolations.length > 0 && (
                  <p className="mt-0.5 pl-3.5 text-warning">
                    style: {row.styleViolations.join(", ")}
                  </p>
                )}
                {row.feedback && (
                  <p className="mt-1 pl-3.5 text-muted-foreground italic">
                    &ldquo;{row.feedback}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
