import { cn } from "@/lib/utils";
import { formatHoursPerWeek } from "@/lib/hackathon/impact";
import {
  PATIENT_IDENTIFIERS_ANSWER,
  QUESTION_BY_ID,
  answerValue,
} from "@/lib/hackathon/questions";
import type { HackathonResponse } from "@/lib/hackathon/state";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * One submitted problem, as it reads in the bank and on your own answer.
 *
 * One component for both, so somebody's own submission never looks
 * different to them than it does to everyone else.
 *
 * Every answer is one row in one column, in the order the survey asked.
 * They were briefly two across with the screening answers demoted to badges
 * in a footer - and those two are the ones the shortlist turns on.
 *
 * Labels are short restatements rather than the survey's question text:
 * "What goes wrong when it is done late or done badly?" is the right way to
 * ask it and the wrong way to label the answer in a list.
 */

const FIELDS: readonly { qid: string; label: string }[] = [
  { qid: "q3", label: "How often" },
  { qid: "q4", label: "Each time" },
  { qid: "q5", label: "Systems involved" },
  { qid: "q6", label: "What goes wrong" },
  { qid: "q7", label: "Patient information" },
  { qid: "q8", label: "Three examples on the day" },
  { qid: "q9", label: "Who would use a fix" },
  { qid: "q10", label: "Also put forward" },
];

/**
 * The dot beside a screening answer - colour in a 6px dot, never a wash, per
 * the status grammar in lib/status.ts.
 *
 * Only questions 7 and 8 get one: they are the two answers read as a verdict
 * rather than as information. Question 7 can rule a problem out entirely,
 * and question 8 decides whether there are examples to work from on the day.
 */
function dotFor(qid: string, value: string): string | null {
  if (qid === "q7") {
    if (value === PATIENT_IDENTIFIERS_ANSWER) return "bg-rose-500";
    if (value === "No") return "bg-emerald-500";
    return "bg-amber-500";
  }
  if (qid === "q8") {
    if (value === "Yes") return "bg-emerald-500";
    if (value === "No") return "bg-muted-foreground/60";
    return "bg-amber-500";
  }
  return null;
}

export function ProblemCard({
  response,
  showWants = false,
  highlight = false,
}: {
  response: HackathonResponse;
  /** Include question 11, which is about the day rather than the problem. */
  showWants?: boolean;
  /** Your own card in the bank, so you can find yourself in the list. */
  highlight?: boolean;
}) {
  const description = answerValue(response.answers, "q2");
  const wants = answerValue(response.answers, "q11");
  const rows = FIELDS.map((field) => ({
    ...field,
    value: answerValue(response.answers, field.qid),
  })).filter((row): row is typeof row & { value: string } => !!row.value);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        highlight ? "border-primary" : "border-border",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">
            {response.displayName}
            {highlight && (
              <Eyebrow className="ml-2">
                You
              </Eyebrow>
            )}
          </h3>
          {response.team && (
            <p className="text-xs text-muted-foreground">{response.team}</p>
          )}
        </div>
        <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
          {formatHoursPerWeek(response.hours)}
          <span className="ml-1 font-sans text-xs text-muted-foreground">
            per week
          </span>
        </p>
      </header>

      {description && (
        <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-foreground">
          {description}
        </p>
      )}

      <dl className="divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const dot = dotFor(row.qid, row.value);
          return (
            <div key={row.qid} className="px-4 py-2.5">
              <dt
                className="text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground"
                title={QUESTION_BY_ID.get(row.qid)?.text}
              >
                {row.label}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-2 text-sm text-foreground">
                {dot && (
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      dot,
                    )}
                  />
                )}
                <span className="min-w-0">{row.value}</span>
              </dd>
            </div>
          );
        })}

        {showWants && wants && (
          <div className="px-4 py-2.5">
            <Eyebrow as="dt">
              Wants out of Monday
            </Eyebrow>
            <dd className="mt-0.5 text-sm text-foreground">{wants}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
