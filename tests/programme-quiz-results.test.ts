import { describe, it, expect } from "vitest";
import {
  alignAttempt,
  buildQuizDetails,
  buildQuizResultRows,
  parseAnswersJson,
  resolveAnswers,
  summariseQuizColumns,
  toQuizColumn,
  type QuizAttempt,
  type QuizColumn,
} from "@/lib/programme/quiz-results";
import { parseQuizConfig, type QuizConfig } from "@/lib/programme/quiz";

function question(label: string, correct = 0) {
  return {
    question: `Q ${label}`,
    options: ["a", "b", "c"],
    correct,
    explanation: `because ${label}`,
  };
}

const CONFIG: QuizConfig = {
  pass_mark: 2,
  question_count: 3,
  summative: false,
  questions: [question("one", 0), question("two", 1), question("three", 2)],
};

function column(over: Partial<QuizColumn> = {}): QuizColumn {
  return {
    trackItemId: "q1",
    title: "Week 1 Quiz",
    dayIndex: 5,
    summative: false,
    passMark: 2,
    questionCount: 3,
    opensOn: "2026-09-04",
    opened: true,
    ...over,
  };
}

function attempt(over: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: "a1",
    cohortMemberId: "m1",
    trackItemId: "q1",
    score: 2,
    answers: [0, 1, 0],
    createdAt: "2026-09-04T09:00:00Z",
    ...over,
  };
}

describe("toQuizColumn", () => {
  it("reads pass mark and count off config_json", () => {
    const c = toQuizColumn({
      id: "q1",
      title: "Week 3 Quiz",
      day_index: 15,
      config_json: { pass_mark: 8, question_count: 10, summative: true },
      opensOn: "2026-09-25",
      opened: false,
    });
    expect(c).toMatchObject({
      passMark: 8,
      questionCount: 10,
      summative: true,
      opened: false,
    });
  });

  it("falls back to a full-marks pass rather than zero", () => {
    // A pass mark of 0 would render every unattempted cell as a pass, so the
    // defensive default has to be the strict end, not the lax one.
    const c = toQuizColumn({
      id: "q1",
      title: "Week 1 Quiz",
      day_index: 5,
      config_json: {},
      opensOn: "2026-09-04",
      opened: true,
    });
    expect(c.questionCount).toBe(10);
    expect(c.passMark).toBe(10);
  });

  it("caps a pass mark that exceeds the question count", () => {
    const c = toQuizColumn({
      id: "q1",
      title: "Week 1 Quiz",
      day_index: 5,
      config_json: { pass_mark: 12, question_count: 10 },
      opensOn: "2026-09-04",
      opened: true,
    });
    expect(c.passMark).toBe(10);
  });
});

describe("buildQuizResultRows", () => {
  const members = [
    { cohortMemberId: "m1", displayName: "Ada" },
    { cohortMemberId: "m2", displayName: "Grace" },
  ];

  it("credits the best score, never the latest", () => {
    const rows = buildQuizResultRows({
      members,
      columns: [column()],
      attempts: [
        attempt({ id: "a1", score: 3, createdAt: "2026-09-04T09:00:00Z" }),
        attempt({ id: "a2", score: 1, createdAt: "2026-09-05T09:00:00Z" }),
      ],
    });
    expect(rows[0].cells[0]).toMatchObject({
      bestScore: 3,
      passed: true,
      attempts: 2,
      lastAttemptAt: "2026-09-05T09:00:00Z",
    });
  });

  it("separates never-attempted from not-open-yet", () => {
    const rows = buildQuizResultRows({
      members,
      columns: [
        column({ trackItemId: "q1", opened: true }),
        column({ trackItemId: "q3", opened: false }),
      ],
      attempts: [],
    });
    expect(rows[0].cells.map((c) => c.state)).toEqual([
      "not-attempted",
      "unopened",
    ]);
  });

  it("shows an attempt on an unopened quiz as attempted", () => {
    // An admin preview run, or a day re-dated after the fact. A score printed
    // beside "not open yet" is a contradiction the reader cannot resolve.
    const rows = buildQuizResultRows({
      members,
      columns: [column({ opened: false })],
      attempts: [attempt({ score: 3 })],
    });
    expect(rows[0].cells[0].state).toBe("attempted");
    expect(rows[0].cells[0].bestScore).toBe(3);
  });

  it("never leaks another cohort's attempts onto a row", () => {
    // The attempts query in loadCohortAdminView has no cohort filter, so this
    // is the invariant that keeps it correct: rows come from members, and an
    // attempt for an unknown member id has nowhere to land.
    const rows = buildQuizResultRows({
      members,
      columns: [column()],
      attempts: [
        attempt({ cohortMemberId: "stranger", score: 3 }),
        attempt({ cohortMemberId: "m2", score: 1 }),
      ],
    });
    expect(rows.map((r) => r.cohortMemberId)).toEqual(["m1", "m2"]);
    expect(rows[0].cells[0].state).toBe("not-attempted");
    expect(rows[1].cells[0]).toMatchObject({ bestScore: 1, passed: false });
  });

  it("counts passes against the quizzes that have opened", () => {
    const rows = buildQuizResultRows({
      members: [members[0]],
      columns: [
        column({ trackItemId: "q1", opened: true }),
        column({ trackItemId: "q2", opened: true }),
        column({ trackItemId: "q3", opened: false }),
      ],
      attempts: [attempt({ trackItemId: "q1", score: 3 })],
    });
    expect(rows[0].passedCount).toBe(1);
    expect(rows[0].openedCount).toBe(2);
  });
});

describe("summariseQuizColumns", () => {
  it("averages best scores among those who attempted", () => {
    const columns = [column()];
    const rows = buildQuizResultRows({
      members: [
        { cohortMemberId: "m1", displayName: "Ada" },
        { cohortMemberId: "m2", displayName: "Grace" },
        { cohortMemberId: "m3", displayName: "Alan" },
      ],
      columns,
      attempts: [
        attempt({ cohortMemberId: "m1", score: 3 }),
        attempt({ cohortMemberId: "m2", score: 1 }),
      ],
    });
    expect(summariseQuizColumns(columns, rows)[0]).toEqual({
      trackItemId: "q1",
      attempted: 2,
      passed: 1,
      averageBest: 2,
    });
  });

  it("reports no average when nobody has attempted", () => {
    const columns = [column()];
    const rows = buildQuizResultRows({
      members: [{ cohortMemberId: "m1", displayName: "Ada" }],
      columns,
      attempts: [],
    });
    expect(summariseQuizColumns(columns, rows)[0].averageBest).toBeNull();
  });
});

describe("alignAttempt", () => {
  it("aligns when the answers still mark to the stored score", () => {
    expect(alignAttempt(CONFIG, { answers: [0, 1, 2], score: 3 })).toBe(
      "aligned",
    );
  });

  it("treats a skipped question as answerable", () => {
    expect(alignAttempt(CONFIG, { answers: [0, 1, null], score: 2 })).toBe(
      "aligned",
    );
  });

  it("is unreadable when the quiz has a different number of questions", () => {
    expect(alignAttempt(CONFIG, { answers: [0, 1], score: 2 })).toBe(
      "unreadable",
    );
  });

  it("is unreadable when an index points past the options that exist", () => {
    expect(alignAttempt(CONFIG, { answers: [0, 1, 9], score: 2 })).toBe(
      "unreadable",
    );
  });

  it("is drifted when the shape fits but the answer key has moved", () => {
    // The specific hazard: config_json is admin-editable, so a reordered
    // option leaves the indices valid and the marking wrong.
    expect(alignAttempt(CONFIG, { answers: [0, 1, 2], score: 1 })).toBe(
      "drifted",
    );
  });
});

describe("buildQuizDetails", () => {
  const columns = [column()];
  const configByItemId = new Map([["q1", CONFIG]]);

  it("orders attempts newest first", () => {
    const details = buildQuizDetails({
      columns,
      configByItemId,
      attempts: [
        attempt({ id: "old", createdAt: "2026-09-04T09:00:00Z" }),
        attempt({ id: "new", createdAt: "2026-09-06T09:00:00Z" }),
      ],
    });
    expect(details[0].attempts.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("displays the stored score even when the questions have drifted", () => {
    const details = buildQuizDetails({
      columns,
      configByItemId,
      attempts: [attempt({ answers: [0, 1, 2], score: 1 })],
    });
    const [only] = details[0].attempts;
    expect(only.alignment).toBe("drifted");
    // The stored score is what the member saw and what G4 reads. Re-marking
    // would show 3 here and disagree with both.
    expect(only.score).toBe(1);
    expect(only.answers).toEqual([]);
  });

  it("withholds the breakdown but keeps the score when unreadable", () => {
    const details = buildQuizDetails({
      columns,
      configByItemId,
      attempts: [attempt({ answers: [0], score: 1 })],
    });
    expect(details[0].attempts[0]).toMatchObject({
      alignment: "unreadable",
      score: 1,
      answers: [],
    });
  });

  it("marks a quiz with no readable config as unreadable throughout", () => {
    const details = buildQuizDetails({
      columns,
      configByItemId: new Map([["q1", null]]),
      attempts: [attempt()],
    });
    expect(details[0].config).toBeNull();
    expect(details[0].attempts[0].alignment).toBe("unreadable");
    expect(details[0].attempts[0].total).toBe(3);
  });

  it("passes on best score, not on the most recent attempt", () => {
    const details = buildQuizDetails({
      columns,
      configByItemId,
      attempts: [
        attempt({ id: "good", score: 3, createdAt: "2026-09-04T09:00:00Z" }),
        attempt({ id: "bad", score: 0, createdAt: "2026-09-06T09:00:00Z" }),
      ],
    });
    expect(details[0].bestScore).toBe(3);
    expect(details[0].passed).toBe(true);
  });
});

describe("resolveAnswers", () => {
  it("resolves indices to the option text and marks each one", () => {
    const resolved = resolveAnswers(CONFIG.questions, [0, 0, null]);
    expect(resolved[0]).toMatchObject({ chosen: 0, correct: 0, wasCorrect: true });
    expect(resolved[1]).toMatchObject({ chosen: 0, correct: 1, wasCorrect: false });
    expect(resolved[2]).toMatchObject({ chosen: null, wasCorrect: false });
    expect(resolved[0].options).toEqual(["a", "b", "c"]);
  });
});

describe("indices are relative to the parsed config, not to config_json", () => {
  it("aligns an attempt marked after a malformed question was dropped", () => {
    // parseQuizConfig drops anything unanswerable and reindexes what is left,
    // and the marker scores against THAT array. So an attempt stored with two
    // answers is correct here even though config_json lists three questions.
    const raw = {
      pass_mark: 2,
      questions: [
        question("one", 0),
        { question: "broken", options: ["only"], correct: 4 },
        question("three", 2),
      ],
    };
    const parsed = parseQuizConfig(raw);
    expect(parsed?.questions).toHaveLength(2);
    expect(alignAttempt(parsed!, { answers: [0, 2], score: 2 })).toBe("aligned");
  });
});

describe("parseAnswersJson", () => {
  it("unwraps the stored shape", () => {
    expect(parseAnswersJson({ answers: [0, 2, 1] })).toEqual([0, 2, 1]);
  });

  it("keeps position when a question was skipped", () => {
    // Position carries the question, so a null cannot be filtered out.
    expect(parseAnswersJson({ answers: [0, null, 1] })).toEqual([0, null, 1]);
  });

  it("nulls anything that is not a usable index", () => {
    expect(parseAnswersJson({ answers: ["2", -1, 1.5, 3] })).toEqual([
      null,
      null,
      null,
      3,
    ]);
  });

  it("survives a row with nothing usable in it", () => {
    expect(parseAnswersJson(null)).toEqual([]);
    expect(parseAnswersJson({})).toEqual([]);
    expect(parseAnswersJson({ answers: "nope" })).toEqual([]);
  });
});
