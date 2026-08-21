"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitQuizAttempt, type QuizResult } from "../actions";

export type RunnerQuestion = {
  question: string;
  options: string[];
};

/**
 * The quiz engine.
 *
 * Questions and options come from the server. The answer key does NOT - and
 * neither do the explanations, because an explanation like "Style is almost
 * always the gap" gives the answer away just as effectively as the index does.
 * Both arrive with the marked result, which is the only moment they are
 * useful anyway.
 *
 * Retakes are unlimited and best score is what counts, so failing is framed as
 * "try again" rather than as a verdict.
 */
export function QuizRunner({
  trackItemId,
  title,
  questions,
  passMark,
  previousBest,
  alreadyPassed,
}: {
  trackItemId: string;
  title: string;
  questions: RunnerQuestion[];
  passMark: number;
  previousBest: number | null;
  alreadyPassed: boolean;
}) {
  const [state, action, pending] = useActionState<QuizResult, FormData>(
    submitQuizAttempt,
    { kind: "idle" },
  );
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [attemptKey, setAttemptKey] = useState(0);

  const answered = answers.filter((a) => a !== null).length;
  const marked = state.kind === "marked";

  if (marked) {
    return (
      <div className="space-y-6">
        <div
          className={cn(
            "rounded-lg border p-5",
            state.passed
              ? "border-border bg-secondary text-secondary-foreground"
              : "border-border bg-card",
          )}
        >
          <h2 className="text-lg font-semibold tracking-tight">
            {state.score} out of {state.total}
          </h2>
          <p className="mt-1 text-sm opacity-90">
            {state.passed
              ? `Passed. You needed ${passMark}.`
              : `You needed ${passMark} to pass. Have another go whenever you like - your best score is the one that counts.`}
          </p>
          {state.justCompletedProgramme && (
            <p className="mt-3 text-sm font-medium">
              That was the last thing outstanding. You&apos;ve completed the
              Core Programme.{" "}
              <Link
                href="/learn/track/certificate"
                className="underline underline-offset-4"
              >
                See your certificate
              </Link>
              .
            </p>
          )}
        </div>

        <ol className="space-y-4">
          {questions.map((q, i) => {
            const correct = state.correctByIndex[i];
            const chosen = answers[i];
            const right = chosen === correct;
            return (
              <li key={i} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white",
                      right ? "bg-emerald-500" : "bg-rose-500",
                    )}
                  >
                    {right ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <XIcon className="size-3" />
                    )}
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {q.question}
                  </p>
                </div>
                <ul className="mt-2 space-y-1 pl-7">
                  {q.options.map((option, oi) => (
                    <li
                      key={oi}
                      className={cn(
                        "rounded px-2 py-1 text-sm",
                        oi === correct && "bg-emerald-50 text-emerald-900",
                        oi === chosen && oi !== correct && "bg-rose-50 text-rose-900",
                        oi !== correct && oi !== chosen && "text-muted-foreground",
                      )}
                    >
                      {option}
                      {oi === correct && (
                        <span className="ml-2 text-xs font-medium">correct</span>
                      )}
                      {oi === chosen && oi !== correct && (
                        <span className="ml-2 text-xs font-medium">
                          you picked this
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {state.explanations[i] && (
                  <p className="mt-2 pl-7 text-sm text-muted-foreground">
                    {state.explanations[i]}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-3 pb-8">
          {!state.passed && (
            <Button
              type="button"
              onClick={() => {
                setAnswers(questions.map(() => null));
                setAttemptKey((k) => k + 1);
                window.scrollTo({ top: 0 });
              }}
            >
              Try again
            </Button>
          )}
          <Link
            href="/learn/track"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            Back to the programme
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} key={attemptKey} className="space-y-6">
      <input type="hidden" name="track_item_id" value={trackItemId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {questions.length} questions, pass at {passMark}. Unlimited retakes.
        </span>
        {previousBest !== null && (
          <span className="tabular-nums">
            Your best so far: {previousBest}/{questions.length}
            {alreadyPassed && " (passed)"}
          </span>
        )}
      </div>

      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={i} className="rounded-lg border border-border bg-background p-4">
            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                {i + 1}. {q.question}
              </legend>
              <div className="mt-3 space-y-1.5" role="radiogroup">
                {q.options.map((option, oi) => (
                  <button
                    key={oi}
                    type="button"
                    role="radio"
                    aria-checked={answers[i] === oi}
                    onClick={() =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[i] = oi;
                        return next;
                      })
                    }
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                      answers[i] === oi
                        ? "border-primary bg-secondary text-secondary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {state.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 pb-8">
        <Button
          type="submit"
          disabled={pending || answered < questions.length}
        >
          {pending ? "Marking…" : `Submit ${title.toLowerCase()}`}
        </Button>
        {answered < questions.length && (
          <span className="text-xs text-muted-foreground">
            {questions.length - answered} still to answer
          </span>
        )}
      </div>
    </form>
  );
}
