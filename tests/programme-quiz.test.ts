import { describe, it, expect } from "vitest";
import {
  bestScore,
  hasPassed,
  incorrectIndexes,
  parseQuizConfig,
  scoreAttempt,
  type QuizQuestionConfig,
} from "@/lib/programme/quiz";

const QUESTIONS: QuizQuestionConfig[] = [
  { question: "one", options: ["a", "b"], correct: 0, explanation: "x" },
  { question: "two", options: ["a", "b"], correct: 1, explanation: "y" },
  { question: "three", options: ["a", "b"], correct: 1, explanation: "z" },
];

describe("scoreAttempt", () => {
  it("counts correct answers", () => {
    expect(scoreAttempt(QUESTIONS, [0, 1, 1])).toBe(3);
    expect(scoreAttempt(QUESTIONS, [0, 1, 0])).toBe(2);
    expect(scoreAttempt(QUESTIONS, [1, 0, 0])).toBe(0);
  });

  it("treats an unanswered question as wrong, not as skipped", () => {
    expect(scoreAttempt(QUESTIONS, [0, null, 1])).toBe(2);
  });

  it("handles a short answer array", () => {
    expect(scoreAttempt(QUESTIONS, [0])).toBe(1);
  });
});

describe("bestScore / hasPassed", () => {
  it("returns null before any attempt", () => {
    expect(bestScore([])).toBeNull();
    expect(hasPassed([], 8)).toBe(false);
  });

  it("takes the maximum, so a retake can never lower your credit", () => {
    // The whole point of unlimited retakes: people should be able to retake to
    // learn without gambling a pass they already earned.
    expect(bestScore([9, 4, 6])).toBe(9);
    expect(hasPassed([9, 4], 8)).toBe(true);
  });

  it("treats exactly the pass mark as a pass", () => {
    expect(hasPassed([8], 8)).toBe(true);
    expect(hasPassed([7], 8)).toBe(false);
  });
});

describe("parseQuizConfig", () => {
  const valid = {
    pass_mark: 2,
    question_count: 3,
    summative: true,
    questions: QUESTIONS,
  };

  it("reads a well-formed config", () => {
    const parsed = parseQuizConfig(valid);
    expect(parsed?.questions).toHaveLength(3);
    expect(parsed?.pass_mark).toBe(2);
    expect(parsed?.summative).toBe(true);
  });

  it("returns null when there are no questions yet", () => {
    // A seeded-but-unwritten quiz should render "not ready", not an empty one.
    expect(parseQuizConfig({ pass_mark: 8, questions: [] })).toBeNull();
    expect(parseQuizConfig(null)).toBeNull();
    expect(parseQuizConfig("nonsense")).toBeNull();
  });

  it("drops a question whose correct index is out of range", () => {
    // config_json is admin-editable, so a typo must not produce a question
    // nobody can answer correctly.
    const parsed = parseQuizConfig({
      ...valid,
      questions: [...QUESTIONS, { question: "bad", options: ["a"], correct: 5, explanation: "" }],
    });
    expect(parsed?.questions).toHaveLength(3);
  });

  it("drops a question with fewer than two options", () => {
    const parsed = parseQuizConfig({
      ...valid,
      questions: [...QUESTIONS, { question: "bad", options: ["only"], correct: 0, explanation: "" }],
    });
    expect(parsed?.questions).toHaveLength(3);
  });

  it("never lets the pass mark exceed the questions that survived", () => {
    // Otherwise an admin deleting a question makes the quiz unpassable.
    const parsed = parseQuizConfig({ ...valid, pass_mark: 99 });
    expect(parsed?.pass_mark).toBe(3);
  });

  it("recounts questions rather than trusting question_count", () => {
    const parsed = parseQuizConfig({ ...valid, question_count: 99 });
    expect(parsed?.question_count).toBe(3);
  });
});

describe("incorrectIndexes", () => {
  it("lists what to review", () => {
    expect(incorrectIndexes(QUESTIONS, [0, 0, 1])).toEqual([1]);
    expect(incorrectIndexes(QUESTIONS, [0, 1, 1])).toEqual([]);
  });

  it("counts unanswered as needing review", () => {
    expect(incorrectIndexes(QUESTIONS, [0, null, 1])).toEqual([1]);
  });
});
