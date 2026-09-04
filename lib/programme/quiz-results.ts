/**
 * Quiz results for the admin screens: the cohort grid and one member's detail.
 *
 * Two rules run through everything here, and both are about not building a
 * screen that is confidently wrong.
 *
 * THE STORED SCORE IS THE SCORE. `programme_quiz_attempts.score` is what the
 * member was shown, what a retake is compared against and what gate G4 reads.
 * These functions never substitute a freshly computed number for it. They do
 * recompute one, but only to detect drift - see below.
 *
 * ANSWER INDICES ARE RELATIVE TO THE PARSED CONFIG AT SUBMIT TIME.
 * `submitQuizAttempt` marks against `parseQuizConfig(config_json)`, and that
 * parser silently drops malformed questions and reindexes what is left. Since
 * `config_json` is admin-editable, an attempt stored last week can no longer
 * line up with the questions the quiz asks today: a reordered option makes
 * every later index point at the wrong text, which is worse than showing
 * nothing because it reads as a member choosing an answer they never saw.
 * So an attempt is only broken down per question when it still aligns, and
 * `alignment` says which of the two cases the caller is in.
 */

import {
  bestScore,
  scoreAttempt,
  type QuizConfig,
  type QuizQuestionConfig,
} from "./quiz";

/** One quiz on the track, in the shape both admin surfaces need. */
export type QuizColumn = {
  trackItemId: string;
  title: string;
  dayIndex: number;
  /** The gate-bearing quiz. Only this one feeds G4. */
  summative: boolean;
  passMark: number;
  questionCount: number;
  /** The date it opens, in the cohort's unlock terms. */
  opensOn: string;
  /** Whether that date has arrived, on the same 7am clock as the members. */
  opened: boolean;
};

/** An attempt as stored, with `answers_json` already unwrapped. */
export type QuizAttempt = {
  id: string;
  cohortMemberId: string;
  trackItemId: string;
  score: number;
  /** Chosen option index per question. Null where a question was skipped. */
  answers: (number | null)[];
  createdAt: string;
};

/**
 * One member's standing on one quiz.
 *
 * `state` is three-valued on purpose. "Not attempted" and "not open yet" look
 * identical in a grid of blank cells, and reading a whole column of blanks as
 * a cohort ignoring a quiz that nobody could have taken yet is the specific
 * mistake this distinction exists to prevent.
 */
export type QuizCellState = "unopened" | "not-attempted" | "attempted";

export type QuizCell = {
  trackItemId: string;
  state: QuizCellState;
  /** Best across attempts, which is what counts. Null when never attempted. */
  bestScore: number | null;
  passed: boolean;
  attempts: number;
  /** Timestamp of the most recent attempt, for "when did they last try". */
  lastAttemptAt: string | null;
};

export type QuizResultRow = {
  cohortMemberId: string;
  displayName: string;
  /** One cell per quiz column, in the same order as the columns. */
  cells: QuizCell[];
  /** Quizzes passed out of the quizzes that have opened. */
  passedCount: number;
  openedCount: number;
};

/** Per-quiz totals for the panel header. */
export type QuizColumnSummary = {
  trackItemId: string;
  attempted: number;
  passed: number;
  /** Mean best score among those who have attempted. Null when nobody has. */
  averageBest: number | null;
};

/**
 * Reads a quiz track item into a column.
 *
 * `config_json` is admin-editable, so the pass mark and question count are
 * read defensively and fall back to the shape the track is seeded with rather
 * than to zero - a pass mark of 0 would render every unattempted cell as a
 * pass.
 */
export function toQuizColumn(item: {
  id: string;
  title: string;
  day_index: number;
  config_json: Record<string, unknown> | null;
  opensOn: string;
  opened: boolean;
}): QuizColumn {
  const config = item.config_json ?? {};
  const questionCount =
    typeof config.question_count === "number" && config.question_count > 0
      ? config.question_count
      : 10;
  const passMark =
    typeof config.pass_mark === "number" && config.pass_mark > 0
      ? Math.min(config.pass_mark, questionCount)
      : questionCount;
  return {
    trackItemId: item.id,
    title: item.title,
    dayIndex: item.day_index,
    summative: config.summative === true,
    passMark,
    questionCount,
    opensOn: item.opensOn,
    opened: item.opened,
  };
}

/**
 * The cohort grid: one row per member, one cell per quiz.
 *
 * Iterates MEMBERS and looks attempts up, never the other way round. The
 * attempts query in `loadCohortAdminView` carries no cohort filter - it pulls
 * every row in the table and stays correct only because lookups are keyed by
 * this cohort's member ids. Mapping over attempts here would put another
 * cohort's scores on this cohort's screen.
 */
export function buildQuizResultRows(args: {
  members: readonly { cohortMemberId: string; displayName: string }[];
  columns: readonly QuizColumn[];
  attempts: readonly QuizAttempt[];
}): QuizResultRow[] {
  const byMember = new Map<string, QuizAttempt[]>();
  for (const attempt of args.attempts) {
    const list = byMember.get(attempt.cohortMemberId);
    if (list) list.push(attempt);
    else byMember.set(attempt.cohortMemberId, [attempt]);
  }

  return args.members.map((member) => {
    const mine = byMember.get(member.cohortMemberId) ?? [];
    const cells = args.columns.map((column) =>
      buildQuizCell(column, mine.filter((a) => a.trackItemId === column.trackItemId)),
    );
    return {
      cohortMemberId: member.cohortMemberId,
      displayName: member.displayName,
      cells,
      passedCount: cells.filter((c) => c.passed).length,
      openedCount: args.columns.filter((c) => c.opened).length,
    };
  });
}

function buildQuizCell(
  column: QuizColumn,
  attempts: readonly QuizAttempt[],
): QuizCell {
  const scores = attempts.map((a) => a.score);
  const best = bestScore(scores);

  // An attempt on a quiz whose day has not arrived is possible - an admin
  // running a preview, or a day that was re-dated after the fact - and it
  // outranks the column's own state, because a score on the screen with
  // "not open yet" beside it is a contradiction the reader cannot resolve.
  const state: QuizCellState =
    attempts.length > 0 ? "attempted" : column.opened ? "not-attempted" : "unopened";

  return {
    trackItemId: column.trackItemId,
    state,
    bestScore: best,
    passed: best !== null && best >= column.passMark,
    attempts: attempts.length,
    lastAttemptAt:
      attempts.length === 0
        ? null
        : attempts.reduce((latest, a) => (a.createdAt > latest ? a.createdAt : latest),
            attempts[0].createdAt),
  };
}

/** Column totals, read off the rows so the header cannot disagree with them. */
export function summariseQuizColumns(
  columns: readonly QuizColumn[],
  rows: readonly QuizResultRow[],
): QuizColumnSummary[] {
  return columns.map((column, i) => {
    const cells = rows.map((r) => r.cells[i]).filter(Boolean);
    const attempted = cells.filter((c) => c.state === "attempted");
    const bests = attempted
      .map((c) => c.bestScore)
      .filter((s): s is number => s !== null);
    return {
      trackItemId: column.trackItemId,
      attempted: attempted.length,
      passed: cells.filter((c) => c.passed).length,
      averageBest:
        bests.length === 0
          ? null
          : bests.reduce((sum, s) => sum + s, 0) / bests.length,
    };
  });
}

/**
 * Whether a stored attempt can still be read back against today's questions.
 *
 * "aligned" is the only state that earns a per-question breakdown. The two
 * failure modes are kept apart because they mean different things to whoever
 * is looking: `unreadable` is a shape problem (the quiz has a different
 * number of questions now, or an index points past the options that exist),
 * while `drifted` lines up structurally but no longer marks to the score that
 * was stored, which means the answer key itself moved.
 */
export type AttemptAlignment = "aligned" | "unreadable" | "drifted";

export function alignAttempt(
  config: QuizConfig,
  attempt: Pick<QuizAttempt, "answers" | "score">,
): AttemptAlignment {
  if (attempt.answers.length !== config.questions.length) return "unreadable";

  const inRange = attempt.answers.every(
    (answer, i) =>
      answer === null ||
      (Number.isInteger(answer) &&
        answer >= 0 &&
        answer < config.questions[i].options.length),
  );
  if (!inRange) return "unreadable";

  // Recomputed ONLY as a drift check. The stored score is still what gets
  // displayed - it is what the member saw and what G4 reads, so a screen
  // showing a different number would be disagreeing with the gate.
  return scoreAttempt(config.questions, attempt.answers) === attempt.score
    ? "aligned"
    : "drifted";
}

/** One question of an attempt, resolved to the text the member actually saw. */
export type ResolvedAnswer = {
  question: string;
  options: string[];
  /** Index they picked, or null if they skipped it. */
  chosen: number | null;
  correct: number;
  wasCorrect: boolean;
  explanation: string;
};

export function resolveAnswers(
  questions: readonly QuizQuestionConfig[],
  answers: readonly (number | null)[],
): ResolvedAnswer[] {
  return questions.map((question, i) => {
    const chosen = answers[i] ?? null;
    return {
      question: question.question,
      options: [...question.options],
      chosen,
      correct: question.correct,
      wasCorrect: chosen === question.correct,
      explanation: question.explanation,
    };
  });
}

/** One attempt in the detail view, newest first, with its readability known. */
export type AttemptDetail = {
  id: string;
  createdAt: string;
  /** As stored. Never recomputed for display. */
  score: number;
  total: number;
  passed: boolean;
  alignment: AttemptAlignment;
  /** Empty unless `alignment` is "aligned". */
  answers: ResolvedAnswer[];
};

export type QuizDetail = {
  column: QuizColumn;
  /** Null when the quiz has no usable config_json, which is a content bug. */
  config: QuizConfig | null;
  bestScore: number | null;
  passed: boolean;
  attempts: AttemptDetail[];
};

/**
 * One member across every quiz on the track.
 *
 * Attempts come back newest first, because a member with four goes at the
 * same quiz is nearly always being looked at for what they did last.
 */
export function buildQuizDetails(args: {
  columns: readonly QuizColumn[];
  configByItemId: ReadonlyMap<string, QuizConfig | null>;
  attempts: readonly QuizAttempt[];
}): QuizDetail[] {
  return args.columns.map((column) => {
    const config = args.configByItemId.get(column.trackItemId) ?? null;
    const mine = args.attempts
      .filter((a) => a.trackItemId === column.trackItemId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const best = bestScore(mine.map((a) => a.score));

    return {
      column,
      config,
      bestScore: best,
      passed: best !== null && best >= column.passMark,
      attempts: mine.map((attempt) => {
        const alignment = config ? alignAttempt(config, attempt) : "unreadable";
        return {
          id: attempt.id,
          createdAt: attempt.createdAt,
          score: attempt.score,
          total: config?.questions.length ?? column.questionCount,
          passed: attempt.score >= column.passMark,
          alignment,
          answers:
            config && alignment === "aligned"
              ? resolveAnswers(config.questions, attempt.answers)
              : [],
        };
      }),
    };
  });
}

/** Unwraps `answers_json`, which is `{ answers: (number | null)[] }`. */
export function parseAnswersJson(raw: unknown): (number | null)[] {
  if (!raw || typeof raw !== "object") return [];
  const answers = (raw as Record<string, unknown>).answers;
  if (!Array.isArray(answers)) return [];
  return answers.map((a) =>
    typeof a === "number" && Number.isInteger(a) && a >= 0 ? a : null,
  );
}
