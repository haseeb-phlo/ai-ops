import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatHoursPerWeek, isSharedReach } from "@/lib/hackathon/impact";
import {
  PATIENT_IDENTIFIERS_ANSWER,
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
 * The hours figure is the headline. Nine of the eleven answers are there to
 * qualify a free-text description that, on its own, gives a reader no way to
 * tell a two-minute irritation from eleven hours a week - so the number goes
 * top right, where the eye lands after the name.
 */
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
  const frequency = answerValue(response.answers, "q3");
  const duration = answerValue(response.answers, "q4");
  const systems = answerValue(response.answers, "q5");
  const consequence = answerValue(response.answers, "q6");
  const patientInfo = answerValue(response.answers, "q7");
  const examples = answerValue(response.answers, "q8");
  const reach = answerValue(response.answers, "q9");
  const secondTask = answerValue(response.answers, "q10");
  const wants = answerValue(response.answers, "q11");

  return (
    <article
      className={cn(
        "rounded-lg border bg-background p-4",
        highlight ? "border-primary" : "border-border",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
        <p className="font-mono text-sm tabular-nums text-foreground">
          {formatHoursPerWeek(response.hours)}
          <span className="ml-1 font-sans text-xs text-muted-foreground">
            per week
          </span>
        </p>
      </header>

      {description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {description}
        </p>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-border pt-3 text-xs sm:grid-cols-2">
        <Field label="How often">{frequency}</Field>
        <Field label="Each time">{duration}</Field>
        <Field label="Systems involved">{systems}</Field>
        <Field label="Who would use a fix">
          {reach}
          {isSharedReach(reach) && (
            <span className="ml-1.5 text-muted-foreground">
              (so multiply the hours)
            </span>
          )}
        </Field>
        <Field label="What goes wrong" className="sm:col-span-2">
          {consequence}
        </Field>
      </dl>

      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {patientInfo && (
          <Badge variant="outline" className="gap-1.5 bg-card">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                patientInfo === PATIENT_IDENTIFIERS_ANSWER
                  ? "bg-rose-500"
                  : patientInfo === "No"
                    ? "bg-emerald-500"
                    : "bg-amber-500",
              )}
            />
            {patientInfo === PATIENT_IDENTIFIERS_ANSWER
              ? "Patient identifiers"
              : patientInfo === "Yes - but only anonymised or aggregated"
                ? "Anonymised patient data"
                : patientInfo === "No"
                  ? "No patient data"
                  : "Patient data unclear"}
          </Badge>
        )}
        {examples && (
          <Badge variant="outline" className="gap-1.5 bg-card">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                examples === "Yes"
                  ? "bg-emerald-500"
                  : examples === "No"
                    ? "bg-muted-foreground/60"
                    : "bg-amber-500",
              )}
            />
            {examples === "Yes"
              ? "Can bring three examples"
              : examples === "No"
                ? "No examples to bring"
                : "Examples unsure"}
          </Badge>
        )}
      </footer>

      {secondTask && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-3xs font-medium uppercase tracking-wide">
            Also put forward
          </span>
          <br />
          {secondTask}
        </p>
      )}

      {showWants && wants && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-3xs font-medium uppercase tracking-wide">
            Wants out of Monday
          </span>
          <br />
          {wants}
        </p>
      )}
    </article>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}
