/**
 * Quiz scoring and completion.
 *
 * Retakes are unlimited and every attempt is stored, so the rule that matters
 * is that a later attempt can never LOWER what you are credited with. Reading
 * the maximum rather than the latest gives that for free, and means a member
 * can retake to learn rather than gambling their pass.
 */

export type QuizOption = string;

export type QuizQuestionConfig = {
  question: string;
  options: QuizOption[];
  correct: number;
  explanation: string;
};

export type QuizConfig = {
  pass_mark: number;
  question_count: number;
  summative: boolean;
  questions: QuizQuestionConfig[];
};

/** Reads a track item's config_json defensively - it is admin-editable. */
export function parseQuizConfig(raw: unknown): QuizConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const questions = Array.isArray(c.questions) ? c.questions : [];

  const parsed: QuizQuestionConfig[] = [];
  for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    const item = q as Record<string, unknown>;
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string")
      : [];
    const correct = typeof item.correct === "number" ? item.correct : -1;
    // Drop anything malformed rather than rendering a question nobody can
    // answer correctly. An admin editing config_json should see the count
    // change, not a silently unanswerable quiz.
    if (
      typeof item.question !== "string" ||
      options.length < 2 ||
      correct < 0 ||
      correct >= options.length
    ) {
      continue;
    }
    parsed.push({
      question: item.question,
      options,
      correct,
      explanation:
        typeof item.explanation === "string" ? item.explanation : "",
    });
  }

  if (parsed.length === 0) return null;

  const passMark =
    typeof c.pass_mark === "number" && c.pass_mark > 0
      ? Math.min(c.pass_mark, parsed.length)
      : parsed.length;

  return {
    pass_mark: passMark,
    question_count: parsed.length,
    summative: c.summative === true,
    questions: parsed,
  };
}

/** Number of correct answers. `answers[i]` is the option index chosen. */
export function scoreAttempt(
  questions: readonly QuizQuestionConfig[],
  answers: readonly (number | null)[],
): number {
  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct) score += 1;
  });
  return score;
}

/** Best score across attempts. Null when they have never attempted it. */
export function bestScore(scores: readonly number[]): number | null {
  return scores.length === 0 ? null : Math.max(...scores);
}

export function hasPassed(
  scores: readonly number[],
  passMark: number,
): boolean {
  const best = bestScore(scores);
  return best !== null && best >= passMark;
}

/** Which questions were answered wrongly, for the review screen. */
export function incorrectIndexes(
  questions: readonly QuizQuestionConfig[],
  answers: readonly (number | null)[],
): number[] {
  return questions
    .map((q, i) => (answers[i] === q.correct ? -1 : i))
    .filter((i) => i >= 0);
}
