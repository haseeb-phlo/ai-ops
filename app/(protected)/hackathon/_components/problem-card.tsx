import { cn } from "@/lib/utils";
import { formatHoursPerWeek, isSharedReach } from "@/lib/hackathon/impact";
import {
  PATIENT_IDENTIFIERS_ANSWER,
  QUESTION_BY_ID,
  answerValue,
} from "@/lib/hackathon/questions";
import type { HackathonResponse } from "@/lib/hackathon/state";

/**
 * One submitted problem, as it reads in the bank and on your own answer.
 *
 * The same component for both, because they are the same thing seen from two
 * places, and a separate "your answer" card is how the two drift until
 * somebody's own submission looks different to them than it does to everyone
 * else.
 *
 * EVERY ANSWER IS ONE ROW IN ONE COLUMN, in the order the survey asked. The
 * fields were briefly laid out two across with the screening answers
 * demoted to badges in a footer, which made a record of nine answers read as
 * four things and a decoration - and the two demoted ones are the two the
 * shortlist actually turns on. A record people have to scan thirty of is
 * read top to bottom or not at all.
 *
 * Labels are short restatements rather than the survey's own question text:
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
 * The dot beside a screening answer. Colour lives in a 6px dot and never
 * washes the row - the app's status grammar, see lib/status.ts.
 *
 * Only the two screening questions get one, because they are the only
 * answers read as a verdict rather than as information: question 7 can rule
 * a problem out of this cohort entirely, and question 8 decides whether
 * there is an evaluation set on the day.
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
              <span className="ml-2 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
                You
              </span>
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
                className="text-3xs font-medium uppercase tracking-wide text-muted-foreground"
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
                <span className="min-w-0">
                  {row.value}
                  {row.qid === "q9" && isSharedReach(row.value) && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      so multiply the hours
                    </span>
                  )}
                </span>
              </dd>
            </div>
          );
        })}

        {showWants && wants && (
          <div className="px-4 py-2.5">
            <dt className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
              Wants out of Monday
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">{wants}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
