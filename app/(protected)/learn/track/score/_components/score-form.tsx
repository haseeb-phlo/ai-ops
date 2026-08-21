"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTIONS,
  type Question,
  type Wave,
} from "@/lib/programme/questions";
import { submitAiScore } from "../actions";

export type PrefilledAnswer = { value: string };

/**
 * "Your AI Score" - the instrument.
 *
 * Two flows through one form:
 *
 *   RETURNER  - every field pre-filled from their last wave, each tagged
 *               "from May" until touched. Must be submittable UNCHANGED in
 *               under 60 seconds, so there is no forced interaction anywhere:
 *               the submit button is live on first paint.
 *   FIRST-TIMER - blank, with the compulsory questions enforced.
 *
 * Untouched answers are submitted as carried_forward, which the server scores
 * identically to a fresh answer. That distinction only exists so Part 7 can
 * tell "unchanged" from "not asked".
 */
export function ScoreForm({
  wave,
  prefill,
  prefillLabel,
  estimatedMinutes,
}: {
  wave: Wave;
  prefill: Record<string, PrefilledAnswer> | null;
  prefillLabel: string | null;
  estimatedMinutes: number;
}) {
  const isReturner = prefill !== null;

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (prefill) {
      for (const [qid, a] of Object.entries(prefill)) initial[qid] = a.value;
    }
    return initial;
  });
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [pending, startTransition] = useTransition();

  // Measured client-side and sent with the submission. Part 7 uses the median
  // per flow as a fatigue tripwire - if returners start taking >6 minutes, the
  // pre-fill has stopped working.
  //
  // Stamped on mount rather than during render: Date.now() in a render body is
  // impure and would drift on every re-render.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const setAnswer = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    setTouched((prev) => new Set(prev).add(qid));
  };

  const sections = useMemo(
    () => ({
      A: QUESTIONS.filter((q) => q.section === "A"),
      C: QUESTIONS.filter((q) => q.section === "C"),
      D: QUESTIONS.filter((q) => q.section === "D"),
      E: QUESTIONS.filter((q) => q.section === "E"),
    }),
    [],
  );

  const required = QUESTIONS.filter((q) => q.required);
  const answeredRequired = required.filter((q) => answers[q.id]).length;
  const progress = Math.round((answeredRequired / required.length) * 100);
  const missing = required.filter((q) => !answers[q.id]);

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

    const payload = Object.entries(answers).map(([qid, value]) => ({
      qid,
      value,
      carried_forward: isReturner && !touched.has(qid),
    }));

    startTransition(async () => {
      const fd = new FormData();
      fd.set("wave", wave);
      fd.set("answers", JSON.stringify(payload));
      fd.set("flow", isReturner ? "returner" : "first_timer");
      if (startedAt.current !== null) {
        fd.set(
          "duration_seconds",
          String(Math.round((Date.now() - startedAt.current) / 1000)),
        );
      }
      const result = await submitAiScore(fd);
      if (result.kind === "error") setError(result.message);
      // On success the action redirects to the result screen.
    });
  };

  return (
    <div className="space-y-8">
      {isReturner && (
        <div className="rounded-lg border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          <p className="font-medium">
            Your {prefillLabel} answers are below - update anything that&apos;s
            changed.
          </p>
          <p className="mt-1 text-secondary-foreground/80">
            Nothing to change? Submit as-is. Takes about {estimatedMinutes}{" "}
            minute{estimatedMinutes === 1 ? "" : "s"}.
          </p>
        </div>
      )}

      {!isReturner && (
        <p className="text-sm text-muted-foreground">
          About {estimatedMinutes} minutes. There are no wrong answers - this
          sets your starting point.
        </p>
      )}

      {/* Progress. Sticky so it stays useful on a long form. */}
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

      <Section title="How you work with AI today">
        {sections.A.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswer(q.id, v)}
            carriedForward={isReturner && !touched.has(q.id) && !!answers[q.id]}
            prefillLabel={prefillLabel}
          />
        ))}
      </Section>

      <Section title="How confident you feel">
        {sections.C.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswer(q.id, v)}
            carriedForward={isReturner && !touched.has(q.id) && !!answers[q.id]}
            prefillLabel={prefillLabel}
            compact
          />
        ))}
      </Section>

      <Section title="How you're finding it">
        {sections.D.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswer(q.id, v)}
            carriedForward={isReturner && !touched.has(q.id) && !!answers[q.id]}
            prefillLabel={prefillLabel}
          />
        ))}
      </Section>

      {/* Optional free text, collapsed. Never blocks submission. */}
      <div className="rounded-lg border border-border bg-background">
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground"
          aria-expanded={showOptional}
        >
          Want to add anything?
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              showOptional && "rotate-180",
            )}
          />
        </button>
        {showOptional && (
          <div className="space-y-5 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">
              All optional - skip anything you&apos;d rather not answer.
            </p>
            {sections.E.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
                carriedForward={false}
                prefillLabel={prefillLabel}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pb-8">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? "Saving…" : "See my AI Score"}
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <h2 className="border-b border-border pb-2 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  carriedForward,
  prefillLabel,
  compact = false,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  carriedForward: boolean;
  prefillLabel: string | null;
  compact?: boolean;
}) {
  const name = `q-${question.id}`;

  return (
    <fieldset id={name} className="space-y-2">
      <legend className="flex flex-wrap items-baseline gap-2 text-sm text-foreground">
        <span className={compact ? "" : "font-medium"}>{question.text}</span>
        {!question.required && (
          <span className="text-xs text-muted-foreground">(optional)</span>
        )}
        {carriedForward && prefillLabel && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
            from {prefillLabel}
          </span>
        )}
      </legend>

      {question.kind === "text" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Optional"
        />
      ) : (
        <div
          className={cn(
            "grid gap-1.5",
            compact && "sm:grid-cols-5 sm:gap-1",
            question.id === "q18" && "grid-cols-3 sm:grid-cols-6",
          )}
          role="radiogroup"
          aria-label={question.text}
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
                  compact && "text-center text-xs",
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
      )}
    </fieldset>
  );
}
