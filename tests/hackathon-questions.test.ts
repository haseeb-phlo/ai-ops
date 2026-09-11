import { describe, it, expect } from "vitest";
import {
  ANSWER_MAX_LENGTH,
  PATIENT_IDENTIFIERS_ANSWER,
  QUESTIONS,
  QUESTION_BY_ID,
  REQUIRED_QUESTION_IDS,
  TEAM_OPTIONS,
  answerValue,
  normalizeAnswerText,
  normalizeLongText,
} from "@/lib/hackathon/questions";

/**
 * The build sheet, retyped.
 *
 * Every string below was copied from
 * ".superset/attachments/AI-Hackathon-Problem-Survey.docx" independently of
 * the module, so this is a comparison of two transcriptions rather than a
 * restatement of one. Question 7's options in particular are matched as text
 * when the shortlist drops anything involving patient identifiers, so a
 * reworded option is a silently broken screening rule.
 */

describe("the question bank matches the build sheet", () => {
  it("asks eleven questions, nine required and two optional", () => {
    expect(QUESTIONS).toHaveLength(11);
    expect(REQUIRED_QUESTION_IDS).toEqual([
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
      "q8",
      "q9",
    ]);
    expect(QUESTIONS.filter((q) => !q.required).map((q) => q.id)).toEqual([
      "q10",
      "q11",
    ]);
  });

  it("asks them in the sheet's order, with the sheet's wording", () => {
    expect(QUESTIONS.map((q) => q.text)).toEqual([
      "Which team are you in?",
      "Describe one task you do regularly that feels like it should not need a person.",
      "How often do you do it?",
      "Roughly how long does it take each time?",
      "Which systems, tools or documents does it involve?",
      "What goes wrong when it is done late or done badly?",
      "Does the task involve patient information?",
      "Could you bring three real examples on Monday, with patient details removed?",
      "Who would use a fix if one existed?",
      "Is there a second task you would like to put forward? One line is enough.",
      "Is there anything specific you want to get out of Monday?",
    ]);
  });

  it("carries the sheet's team list, not the people directory's", () => {
    // The directory holds sixteen teams including Patient Services, Product
    // Marketing and Technology; the sheet offers these eleven buckets.
    expect(TEAM_OPTIONS).toEqual([
      "Patient Care",
      "Dispensary / Fulfilment",
      "Clinical (pharmacists, prescribers, dieticians)",
      "Marketing",
      "Product",
      "Design",
      "Finance",
      "People & Culture",
      "Governance",
      "Engineering",
      "Other",
    ]);
    expect(QUESTION_BY_ID.get("q1")!.options).toEqual(TEAM_OPTIONS);
  });

  it("carries the sheet's frequency and duration options verbatim", () => {
    expect(QUESTION_BY_ID.get("q3")!.options).toEqual([
      "Several times a day",
      "About once a day",
      "A few times a week",
      "About once a week",
      "A few times a month",
    ]);
    expect(QUESTION_BY_ID.get("q4")!.options).toEqual([
      "Under 5 minutes",
      "5 to 15 minutes",
      "15 to 30 minutes",
      "30 to 60 minutes",
      "Over an hour",
    ]);
  });

  it("carries the patient-information options verbatim, screening one first", () => {
    expect(QUESTION_BY_ID.get("q7")!.options).toEqual([
      "Yes - names, addresses or medical details",
      "Yes - but only anonymised or aggregated",
      "No",
      "Not sure",
    ]);
    // The exported constant is what the shortlist rule and the card compare
    // against, so it has to BE one of the options, not resemble one.
    expect(QUESTION_BY_ID.get("q7")!.options).toContain(
      PATIENT_IDENTIFIERS_ANSWER,
    );
  });

  it("carries the examples and reach options verbatim", () => {
    expect(QUESTION_BY_ID.get("q8")!.options).toEqual(["Yes", "No", "Not sure"]);
    expect(QUESTION_BY_ID.get("q9")!.options).toEqual([
      "Just me",
      "My team",
      "Several teams",
      "Not sure",
    ]);
  });

  it("keeps the sheet's subtitles on the four questions that have one", () => {
    expect(QUESTIONS.filter((q) => q.subtitle).map((q) => q.id)).toEqual([
      "q2",
      "q5",
      "q6",
      "q11",
    ]);
    expect(QUESTION_BY_ID.get("q5")!.subtitle).toBe(
      "Name them. For example: Intercom, Jira, Slack, Outlook, a spreadsheet, the pharmacy system, Confluence.",
    );
    expect(QUESTION_BY_ID.get("q6")!.subtitle).toBe(
      "For example: a patient waits longer, a colleague has to redo it, something gets missed, a complaint.",
    );
  });

  it("asks the long description as the only long-text question", () => {
    expect(QUESTIONS.filter((q) => q.kind === "text_long").map((q) => q.id)).toEqual(
      ["q2"],
    );
  });

  it("gives every question an id that is unique and in the lookup", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(QUESTION_BY_ID.get(id)).toBeDefined();
  });

  it("gives choice questions options and text questions none", () => {
    for (const question of QUESTIONS) {
      if (question.kind === "choice") {
        expect(question.options?.length, question.id).toBeGreaterThan(1);
      } else {
        expect(question.options, question.id).toBeUndefined();
      }
    }
  });

  it("bounds a stored answer", () => {
    expect(ANSWER_MAX_LENGTH).toBeGreaterThan(500);
  });
});

describe("normalizeAnswerText", () => {
  it("resolves the variation that separates a match from a miss", () => {
    // A non-breaking space pasted mid-option is the failure this exists for:
    // the option lookup is an exact match, so without it the answer is
    // rejected as tampered.
    expect(normalizeAnswerText("Yes - names, addresses or medical details")).toBe(
      "Yes - names, addresses or medical details",
    );
    expect(normalizeAnswerText("‘Intercom’")).toBe("'Intercom'");
    expect(normalizeAnswerText("“Intercom”")).toBe('"Intercom"');
    expect(normalizeAnswerText("Jira – Slack")).toBe("Jira - Slack");
    expect(normalizeAnswerText("  Intercom,   Jira  ")).toBe("Intercom, Jira");
  });

  it("collapses newlines, which short answers should not carry", () => {
    expect(normalizeAnswerText("Intercom\nJira")).toBe("Intercom Jira");
  });
});

describe("normalizeLongText", () => {
  it("keeps the paragraph breaks a step-by-step answer needs", () => {
    expect(normalizeLongText("I open Intercom.\nThen I reply.")).toBe(
      "I open Intercom.\nThen I reply.",
    );
  });

  it("still resolves the character variation", () => {
    expect(normalizeLongText("the patient’s address – twice")).toBe(
      "the patient's address - twice",
    );
  });

  it("tidies trailing spaces, blank-line runs and the edges", () => {
    expect(normalizeLongText("  one   \n\n\n\ntwo\r\nthree  ")).toBe(
      "one\n\ntwo\nthree",
    );
  });
});

describe("answerValue", () => {
  it("reads a stored answer and treats blank as absent", () => {
    const answers = { q1: { value: "Product" }, q5: { value: "   " } };
    expect(answerValue(answers, "q1")).toBe("Product");
    expect(answerValue(answers, "q5")).toBeNull();
    expect(answerValue(answers, "q9")).toBeNull();
    expect(answerValue(null, "q1")).toBeNull();
    expect(answerValue(undefined, "q1")).toBeNull();
  });
});
