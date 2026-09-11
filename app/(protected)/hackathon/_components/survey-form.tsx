"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTIONS,
  answerValue,
  type Answers,
  type Question,
} from "@/lib/hackathon/questions";
import { formatHoursPerWeek, hoursPerWeek } from "@/lib/hackathon/impact";
import { submitHackathonSurvey } from "../actions";

/**
 * "What should we fix on Monday?" - the instrument.
 *
 * Deliberately the most ordinary survey shape there is: one numbered
 * question per card, top to bottom, and every answer in a single column
 * under the question it belongs to. Options were briefly laid out two
 * across, which saves a screen of scrolling and costs the thing a survey
 * cannot afford - with two columns there is no one reading order, so
 * "several times a day" and "about once a week" sit side by side and get
 * picked by position instead of by meaning.
 *
 * The choices are native `<input type="radio">` rather than styled buttons.
 * That is what makes a group behave the way people already expect: arrow
 * keys move within it, Tab leaves it, and a screen reader announces "3 of
 * 5". A `role="radio"` button reimplements all of that, usually
 * incompletely.
 *
 * Answers live in component state until submit, as `ScoreForm` does, which
 * is why there is no partial save: a five-minute form that saves drafts is a
 * five-minute form with a second failure mode.
 *
 * The hours-per-week readout under question 4 is the one piece of feedback
 * the paper version cannot give. It is the same pure function the problem
 * bank ranks by (`lib/hackathon/impact.ts`), so what someone sees while
 * answering is what their problem is later sorted on - and watching "5.6 hrs
 * a week" appear is what makes a small repetitive task feel worth
 * submitting.
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
    <div className="space-y-4">
      {/* Said once, at the top, rather than beside the free-text questions:
          it is a rule about the whole form, and a warning that appears three
          questions in has already been ignored twice. */}
      <p className="rounded-lg border border-border bg-secondary px-4 py-3 text-xs leading-relaxed text-secondary-foreground">
        Everyone invited reads these answers once they have answered
        themselves. Describe the task, not the patient: no names, addresses,
        dates of birth or medical details anywhere in this form.
      </p>

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
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {answeredRequired}/{required.length}
          </span>
        </div>
      </div>

      {QUESTIONS.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          number={index + 1}
          total={QUESTIONS.length}
          value={answers[question.id] ?? ""}
          onChange={(v) => setAnswer(question.id, v)}
          footnote={
            question.id === "q4" && hours ? (
              <>
                That is roughly{" "}
                <span className="font-medium text-foreground">
                  {formatHoursPerWeek(hours)}
                </span>{" "}
                a week, every week.
              </>
            ) : null
          }
        />
      ))}

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
            {missing.length} still to answer
          </span>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  number,
  total,
  value,
  onChange,
  footnote,
}: {
  question: Question;
  number: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  footnote?: React.ReactNode;
}) {
  const name = `q-${question.id}`;
  const describedBy = question.subtitle ? `${name}-help` : undefined;

  return (
    <fieldset
      id={name}
      // scroll-mt clears the sticky progress bar when the submit button
      // scrolls the first unanswered question into view.
      className="scroll-mt-20 rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <legend className="sr-only">{`Question ${number} of ${total}: ${question.text}`}</legend>

      <div aria-hidden className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
        Question {number} of {total}
        {!question.required && " · optional"}
      </div>
      <p aria-hidden className="mt-1 text-sm font-medium text-foreground">
        {question.text}
      </p>
      {question.subtitle && (
        <p id={describedBy} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {question.subtitle}
        </p>
      )}

      <div className="mt-3">
        {question.kind === "choice" ? (
          // One column, at every width. See the docblock.
          <div className="flex flex-col gap-1.5">
            {question.options?.map((option) => {
              const selected = value === option;
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition",
                    "has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    selected
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={option}
                    checked={selected}
                    onChange={() => onChange(option)}
                    aria-describedby={describedBy}
                    className="size-4 shrink-0 accent-primary outline-none"
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        ) : question.kind === "text_long" ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            aria-label={question.text}
            aria-describedby={describedBy}
            placeholder="Two or three sentences is plenty."
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={question.text}
            aria-describedby={describedBy}
            placeholder={question.required ? undefined : "Optional"}
          />
        )}
      </div>

      {footnote && (
        <p className="mt-2.5 text-xs text-muted-foreground">{footnote}</p>
      )}
    </fieldset>
  );
}
