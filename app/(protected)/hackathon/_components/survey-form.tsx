"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTIONS,
  SECTIONS,
  answerValue,
  type Answers,
  type Question,
} from "@/lib/hackathon/questions";
import { formatHoursPerWeek, hoursPerWeek } from "@/lib/hackathon/impact";
import { submitHackathonSurvey } from "../actions";

/**
 * "What should we fix on Monday?" - the instrument.
 *
 * Eleven questions, nine of them required, and the build sheet's target is
 * under five minutes. Everything here serves that number: one page with no
 * branching, choices as single-tap buttons rather than dropdowns, a progress
 * count that only counts the nine, and the two optional questions visibly
 * marked so nobody spends time on them thinking they have to.
 *
 * Answers live in component state until submit, exactly as `ScoreForm` does,
 * which is why this carries no partial-save: a five-minute form that saves
 * drafts is a five-minute form with a second failure mode.
 *
 * The hours-per-week readout under question 4 is the one piece of feedback
 * the paper version cannot give. It is the same pure function the problem
 * bank ranks by (`lib/hackathon/impact.ts`), so what someone sees while
 * answering is what their problem is later sorted on - and seeing "5.6 hrs a
 * week" appear is what makes a small repetitive task feel worth submitting.
 */
export function SurveyForm({
  initial,
  submittedAlready,
}: {
  /** Their existing answers when they are revising. */
  initial: Answers | null;
  submittedAlready: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const question of QUESTIONS) {
      const existing = answerValue(initial, question.id);
      if (existing) seed[question.id] = existing;
    }
    return seed;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Stamped on mount, not during render: Date.now() in a render body is
  // impure and drifts on every re-render.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const setAnswer = (qid: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  const required = useMemo(() => QUESTIONS.filter((q) => q.required), []);
  const answeredRequired = required.filter((q) => answers[q.id]?.trim()).length;
  const missing = required.filter((q) => !answers[q.id]?.trim());
  const progress = Math.round((answeredRequired / required.length) * 100);

  const hours = hoursPerWeek(answers.q3, answers.q4);

  const handleSubmit = () => {
    setError(null);
    if (missing.length > 0) {
      setError(
        `${missing.length} question${missing.length === 1 ? "" : "s"} still to answer.`,
      );
      document
        .getElementById(`q-${missing[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = Object.entries(answers)
      .map(([qid, value]) => ({ qid, value }))
      .filter((a) => a.value.trim() !== "");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("answers", JSON.stringify(payload));
      if (startedAt.current !== null) {
        fd.set(
          "duration_seconds",
          String(Math.round((Date.now() - startedAt.current) / 1000)),
        );
      }
      const result = await submitHackathonSurvey(fd);
      if (result.kind === "error") setError(result.message);
      // On success the action redirects.
    });
  };

  return (
    <div className="space-y-8">
      {/* Progress. Sticky, because nine required questions is long enough to
          lose your place in. */}
      <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {answeredRequired}/{required.length}
          </span>
        </div>
      </div>

      {SECTIONS.map((section) => {
        const questions = QUESTIONS.filter((q) => q.section === section.key);
        return (
          <section key={section.key} className="space-y-5">
            <h2 className="border-b border-border pb-2 text-sm font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            {section.key === "task" && (
              <p className="rounded-lg border border-border bg-secondary p-3 text-xs text-secondary-foreground">
                Everyone in the cohort reads these answers once they have
                answered themselves. Describe the task, not the patient: no
                names, addresses, dates of birth or medical details in the
                boxes below.
              </p>
            )}
            {questions.map((question) => (
              <div key={question.id} className="space-y-2">
                <QuestionField
                  question={question}
                  value={answers[question.id] ?? ""}
                  onChange={(v) => setAnswer(question.id, v)}
                />
                {question.id === "q4" && hours && (
                  <p className="text-xs text-muted-foreground">
                    That is roughly{" "}
                    <span className="font-medium text-foreground">
                      {formatHoursPerWeek(hours)}
                    </span>{" "}
                    a week, every week.
                  </p>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending
            ? "Saving…"
            : submittedAlready
              ? "Save my changes"
              : "Submit my problem"}
        </Button>
        {missing.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {missing.length} left
          </span>
        )}
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  const name = `q-${question.id}`;
  const describedBy = question.subtitle ? `${name}-help` : undefined;

  return (
    <fieldset id={name} className="space-y-2">
      <legend className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-foreground">
        <span>{question.text}</span>
        {!question.required && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
            Optional
          </span>
        )}
      </legend>

      {question.subtitle && (
        <p id={describedBy} className="text-xs text-muted-foreground">
          {question.subtitle}
        </p>
      )}

      {question.kind === "choice" ? (
        <div
          className="grid gap-1.5 sm:grid-cols-2"
          role="radiogroup"
          aria-label={question.text}
          aria-describedby={describedBy}
        >
          {question.options?.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : question.kind === "text_long" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          aria-describedby={describedBy}
          placeholder="Two or three sentences is plenty."
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          placeholder={question.required ? undefined : "Optional"}
        />
      )}
    </fieldset>
  );
}
