import { describe, it, expect } from "vitest";
import { buildSubmission, type RawAnswer } from "@/lib/hackathon/submission";
import { REQUIRED_QUESTION_IDS } from "@/lib/hackathon/questions";

/** A complete, valid submission. Individual tests bend one answer at a time. */
function complete(overrides: Record<string, string> = {}): RawAnswer[] {
  const base: Record<string, string> = {
    q1: "Patient Care",
    q2: "When a patient emails to change their delivery address I open Intercom, find their order, update it, then reply.",
    q3: "Several times a day",
    q4: "5 to 15 minutes",
    q5: "Intercom, the pharmacy system",
    q6: "A patient waits longer for their delivery.",
    q7: "Yes - names, addresses or medical details",
    q8: "Yes",
    q9: "My team",
    ...overrides,
  };
  return Object.entries(base).map(([qid, value]) => ({ qid, value }));
}

describe("buildSubmission", () => {
  it("accepts a complete submission and stores every answer", () => {
    const result = buildSubmission(complete());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.answers).sort()).toEqual(
      [...REQUIRED_QUESTION_IDS].sort(),
    );
    expect(result.answers.q1).toEqual({ value: "Patient Care" });
  });

  it("keeps the two optional answers when they are given", () => {
    const result = buildSubmission([
      ...complete(),
      { qid: "q10", value: "Chasing the same prescription query twice a day." },
      { qid: "q11", value: "How to test whether AI output is right." },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.q10.value).toBe(
      "Chasing the same prescription query twice a day.",
    );
    expect(result.answers.q11.value).toBe(
      "How to test whether AI output is right.",
    );
  });

  it("names how many required questions are still unanswered", () => {
    const short = complete().filter((a) => !["q6", "q9"].includes(a.qid));
    expect(buildSubmission(short)).toEqual({
      ok: false,
      message: "2 questions still to answer.",
    });
  });

  it("counts one missing question in the singular", () => {
    const short = complete().filter((a) => a.qid !== "q2");
    expect(buildSubmission(short)).toEqual({
      ok: false,
      message: "1 question still to answer.",
    });
  });

  it("treats a whitespace-only required answer as unanswered", () => {
    expect(buildSubmission(complete({ q6: "   " })).ok).toBe(false);
  });

  it("drops a blank optional answer instead of storing an empty string", () => {
    const result = buildSubmission([
      ...complete(),
      { qid: "q10", value: "  " },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.q10).toBeUndefined();
  });

  it("rejects a closed answer that is not one of the question's options", () => {
    const result = buildSubmission(complete({ q9: "Everyone, probably" }));
    expect(result).toEqual({
      ok: false,
      message: 'Unexpected answer for "Who would use a fix if one existed?".',
    });
  });

  it("rejects a near-miss on the patient-information screening question", () => {
    // The shortlist rule compares this answer as text. "Yes" alone would be
    // stored as an unrecognised screening answer and quietly stop matching.
    expect(buildSubmission(complete({ q7: "Yes" })).ok).toBe(false);
    expect(
      buildSubmission(complete({ q7: "yes - names, addresses or medical details" }))
        .ok,
    ).toBe(false);
  });

  it("accepts an option retyped with a non-breaking space or smart quote", () => {
    // A differently-typed right answer is not a wrong answer: this is what
    // normalisation is for, and it runs before the option check.
    expect(
      buildSubmission(complete({ q3: "Several times a day" })).ok,
    ).toBe(true);
    expect(
      buildSubmission(complete({ q7: "Yes – names, addresses or medical details" }))
        .ok,
    ).toBe(true);
  });

  it("ignores a question id that is not in the bank", () => {
    const result = buildSubmission([
      ...complete(),
      { qid: "q99", value: "left over from an older form" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.q99).toBeUndefined();
  });

  it("keeps the line breaks in the step-by-step description", () => {
    const result = buildSubmission(
      complete({ q2: "I open Intercom.\nI find the order.\nI reply." }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.q2.value).toBe(
      "I open Intercom.\nI find the order.\nI reply.",
    );
  });

  it("collapses line breaks pasted into a short answer", () => {
    const result = buildSubmission(complete({ q5: "Intercom\nJira" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.q5.value).toBe("Intercom Jira");
  });

  it("rejects an empty payload with every required question named", () => {
    expect(buildSubmission([])).toEqual({
      ok: false,
      message: "9 questions still to answer.",
    });
  });
});
