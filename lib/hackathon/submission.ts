/**
 * Turning a submitted payload into answers, or into a reason it is not.
 *
 * Lives here rather than inside `hackathon/actions.ts` for the reason the
 * repo splits every rule out of a `"use server"` file: such a file may only
 * export async functions, so nothing in it can be unit-tested, and this is
 * the one part of the survey with branches worth testing. The action keeps
 * the things only it can do - the writer gate, the invite re-check, the
 * upsert, the redirect.
 *
 * Three rules, and the middle one is the load-bearing one:
 *
 *   1. Unknown question ids are dropped, not rejected. A stale tab posting a
 *      question that has since been removed should still record the ten
 *      answers that are still asked.
 *   2. A closed question must carry one of its own options VERBATIM. Question
 *      7's options are compared as text when the shortlist drops anything
 *      involving patient identifiers, so an almost-right string is a
 *      screening answer that reads as a different one later. Normalisation
 *      (nbsp, smart quotes) runs first, so this rejects wrong answers rather
 *      than differently-typed ones.
 *   3. Blank is absent. A required question answered with spaces is
 *      unanswered, which is what makes the missing-question list honest.
 */

import {
  QUESTION_BY_ID,
  REQUIRED_QUESTION_IDS,
  normalizeAnswerText,
  normalizeLongText,
  type Answers,
} from "./questions";

export type RawAnswer = { qid: string; value: string };

export type SubmissionResult =
  | { ok: true; answers: Answers }
  | { ok: false; message: string };

export function buildSubmission(raw: readonly RawAnswer[]): SubmissionResult {
  const answers: Answers = {};

  for (const answer of raw) {
    const question = QUESTION_BY_ID.get(answer.qid);
    if (!question) continue; // rule 1

    // Line breaks survive in the step-by-step description and are collapsed
    // everywhere else - see normalizeLongText.
    const value =
      question.kind === "text_long"
        ? normalizeLongText(answer.value)
        : normalizeAnswerText(answer.value);
    if (value === "") continue; // rule 3

    if (question.options && !question.options.includes(value)) {
      return { ok: false, message: `Unexpected answer for "${question.text}".` }; // rule 2
    }

    answers[answer.qid] = { value };
  }

  const missing = REQUIRED_QUESTION_IDS.filter((qid) => !answers[qid]);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `${missing.length} question${missing.length === 1 ? "" : "s"} still to answer.`,
    };
  }

  return { ok: true, answers };
}
