import { cn } from "@/lib/utils";
import { formatIsoDate } from "@/lib/programme/working-days";
import type { AttemptDetail, QuizDetail } from "@/lib/programme/quiz-results";

/**
 * Every attempt one member made, newest first within each quiz.
 *
 * The score shown is always the STORED one. An attempt is also re-marked
 * against today's questions, but only to find out whether it still lines up:
 * `answers_json` holds option indices relative to the config as it was parsed
 * at submit time, and `config_json` is admin-editable, so an edited quiz can
 * leave an old attempt pointing at options that have moved. Showing a
 * recomputed number would disagree with what the member saw and with what
 * gate G4 reads, so a drifted attempt keeps its score and loses its
 * breakdown, with the reason said out loud.
 */
export function MemberQuizDetail({ quizzes }: { quizzes: QuizDetail[] }) {
  return (
    <div className="space-y-6">
      {quizzes.map((quiz) => (
        <section
          key={quiz.column.trackItemId}
          className="rounded-lg border border-border bg-background p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
              {quiz.column.title}
              {quiz.column.summative && (
                <span className="rounded border border-border px-1 py-px text-3xs font-normal text-muted-foreground">
                  counts for G4
                </span>
              )}
            </h3>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {quiz.bestScore === null ? (
                quiz.column.opened ? (
                  "Not attempted"
                ) : (
                  `Opens ${formatIsoDate(quiz.column.opensOn)}`
                )
              ) : (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      quiz.passed ? "bg-success" : "bg-destructive",
                    )}
                  />
                  <span className="font-mono tabular-nums text-foreground">
                    best {quiz.bestScore}/{quiz.column.questionCount}
                  </span>
                  <span>
                    {quiz.passed ? "passed" : "not passed"} · pass mark{" "}
                    {quiz.column.passMark}
                  </span>
                </>
              )}
            </p>
          </div>

          {quiz.config === null && (
            <p className="mt-3 rounded-md border border-border border-l-2 border-l-warning bg-background px-3 py-2 text-xs text-foreground">
              This quiz has no readable questions in its config, so answers
              cannot be shown. Any scores below are still what was recorded.
            </p>
          )}

          {quiz.attempts.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {quiz.column.opened
                ? "Nothing recorded yet."
                : "Nobody can take this one yet."}
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {quiz.attempts.map((attempt, i) => (
                <Attempt
                  key={attempt.id}
                  attempt={attempt}
                  label={
                    i === 0 && quiz.attempts.length > 1
                      ? "Most recent"
                      : `Attempt ${quiz.attempts.length - i}`
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Attempt({
  attempt,
  label,
}: {
  attempt: AttemptDetail;
  label: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              attempt.passed ? "bg-success" : "bg-destructive",
            )}
          />
          <span className="font-medium">{label}</span>
          <span className="font-mono tabular-nums">
            {attempt.score}/{attempt.total}
          </span>
        </p>
        <p className="text-3xs text-muted-foreground tabular-nums">
          {formatIsoDate(attempt.createdAt.slice(0, 10), "long")}
        </p>
      </div>

      {attempt.alignment !== "aligned" ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {attempt.alignment === "drifted"
            ? "The questions have been edited since this attempt, so the answers no longer mark to the score that was recorded. The score above stands - it is what was credited - but showing which option was picked would name an option this member never saw."
            : "This attempt does not line up with the quiz as it stands now, so the individual answers cannot be replayed. The score above is what was recorded."}
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {attempt.answers.map((answer, i) => (
            <li key={i} className="px-3 py-3">
              <p className="flex gap-2 text-xs text-foreground">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    answer.wasCorrect ? "bg-success" : "bg-destructive",
                  )}
                />
                <span>
                  <span className="font-mono text-muted-foreground">
                    {i + 1}.
                  </span>{" "}
                  {answer.question}
                </span>
              </p>
              <ul className="mt-2 ml-3.5 space-y-1">
                {answer.options.map((option, oi) => {
                  const chosen = answer.chosen === oi;
                  const correct = answer.correct === oi;
                  if (!chosen && !correct) return null;
                  return (
                    <li
                      key={oi}
                      className="flex flex-wrap items-baseline gap-1.5 text-xs"
                    >
                      <span className="rounded border border-border px-1 py-px text-3xs text-muted-foreground">
                        {chosen && correct
                          ? "picked, correct"
                          : chosen
                            ? "picked"
                            : "correct answer"}
                      </span>
                      <span
                        className={cn(
                          chosen && !correct
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {option}
                      </span>
                    </li>
                  );
                })}
                {answer.chosen === null && (
                  <li className="text-xs text-muted-foreground">
                    Left unanswered.
                  </li>
                )}
              </ul>
              {!answer.wasCorrect && answer.explanation && (
                <p className="mt-2 ml-3.5 text-3xs leading-relaxed text-muted-foreground">
                  {answer.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
