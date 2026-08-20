import { describe, it, expect } from "vitest";
import { QUIZ_CONTENT_BY_DAY } from "@/lib/programme/quiz-content";
import { QUIZ_SPECS, DAY_TOPICS } from "@/lib/programme/track-spec";

describe("quiz content", () => {
  it("has content for every quiz in the track", () => {
    for (const spec of QUIZ_SPECS) {
      expect(QUIZ_CONTENT_BY_DAY[spec.dayIndex], `day ${spec.dayIndex}`).toBeDefined();
    }
  });

  it("matches the question count each quiz declares", () => {
    for (const spec of QUIZ_SPECS) {
      expect(QUIZ_CONTENT_BY_DAY[spec.dayIndex]).toHaveLength(spec.questionCount);
    }
  });

  it("never sets a pass mark nobody could reach", () => {
    for (const spec of QUIZ_SPECS) {
      expect(spec.passMark).toBeLessThanOrEqual(
        QUIZ_CONTENT_BY_DAY[spec.dayIndex].length,
      );
    }
  });

  it("gives every question four options and a valid answer", () => {
    for (const questions of Object.values(QUIZ_CONTENT_BY_DAY)) {
      for (const q of questions) {
        expect(q.options).toHaveLength(4);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(4);
        expect(q.options[q.correct]).toBeTruthy();
      }
    }
  });

  it("explains every answer, since that's where the learning lands", () => {
    for (const questions of Object.values(QUIZ_CONTENT_BY_DAY)) {
      for (const q of questions) {
        expect(q.explanation.length).toBeGreaterThan(40);
      }
    }
  });

  it("has no duplicate options within a question", () => {
    for (const questions of Object.values(QUIZ_CONTENT_BY_DAY)) {
      for (const q of questions) {
        expect(new Set(q.options).size).toBe(4);
      }
    }
  });

  it("does not always put the answer in the same position", () => {
    // A quiz where the answer is always B is a quiz you can pass without
    // reading it.
    const all = Object.values(QUIZ_CONTENT_BY_DAY).flat();
    expect(new Set(all.map((q) => q.correct)).size).toBeGreaterThan(1);
  });

  it("draws only on days that exist in the curriculum", () => {
    for (const questions of Object.values(QUIZ_CONTENT_BY_DAY)) {
      for (const q of questions) {
        expect(q.day).toBeGreaterThanOrEqual(1);
        expect(q.day).toBeLessThanOrEqual(DAY_TOPICS.length);
      }
    }
  });

  it("uses no em dashes anywhere", () => {
    // House style: hyphens, not em dashes. Checked rather than trusted, since
    // an em dash is easy to reintroduce without noticing.
    for (const [day, questions] of Object.entries(QUIZ_CONTENT_BY_DAY)) {
      for (const q of questions) {
        const text = [q.question, ...q.options, q.explanation].join(" ");
        expect(text, `day ${day}: "${q.question.slice(0, 40)}..."`).not.toMatch(
          /[\u2014\u2013]/,
        );
      }
    }
  });

  it("asks ten questions in every quiz", () => {
    for (const questions of Object.values(QUIZ_CONTENT_BY_DAY)) {
      expect(questions).toHaveLength(10);
    }
  });

  it("covers week 1's days in the week 1 quiz, and week 2's in week 2", () => {
    const week1 = new Set(QUIZ_CONTENT_BY_DAY[5].map((q) => q.day));
    const week2 = new Set(QUIZ_CONTENT_BY_DAY[10].map((q) => q.day));
    expect([...week1].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect([...week2].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
  });

  it("makes the final quiz span all three weeks, not just week 3", () => {
    // It gates the certificate, so it should test the programme, not the
    // fortnight people most recently watched.
    const days = QUIZ_CONTENT_BY_DAY[15].map((q) => q.day);
    expect(days.some((d) => d <= 5)).toBe(true);
    expect(days.some((d) => d > 5 && d <= 10)).toBe(true);
    expect(days.some((d) => d > 10)).toBe(true);
  });
});
