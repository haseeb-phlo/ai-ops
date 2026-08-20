import { describe, it, expect } from "vitest";
import fixture from "./fixtures/may-2026-distribution.json";
import {
  CAPABILITY_AXIS_LABEL,
  CAPABILITY_QUESTION_IDS,
  LIKERT_OPTIONS,
  MAY_HEADER_TO_QID,
  MAY_HEADER_TO_QID_RAW,
  MAY_QID_BY_COLUMN_ORDER,
  QUESTIONS,
  QUESTION_BY_ID,
  REQUIRED_QUESTION_IDS,
  normalizeAnswerText,
} from "@/lib/programme/questions";

/**
 * These tests exist because q1-q23 wording is the instrument. If a string
 * drifts, every cross-wave comparison silently compares different questions -
 * and nothing else in the system would notice.
 *
 * The fixture is generated from the May 2026 export (108 responses) and is the
 * ground truth. It is not a snapshot of our own output.
 */

const dist = fixture.distributions as Record<string, Record<string, number>>;

describe("May 2026 fixture sanity", () => {
  it("holds all 108 responses with no duplicate emails", () => {
    expect(fixture.rowCount).toBe(108);
    expect(fixture.emailCount).toBe(108);
    expect(fixture.uniqueEmailCount).toBe(108);
  });
});

describe("question bank matches the May 2026 export", () => {
  it("maps 23 headers to q1..q23 in column order", () => {
    expect(Object.keys(MAY_HEADER_TO_QID)).toHaveLength(23);
    expect(MAY_QID_BY_COLUMN_ORDER).toEqual(
      Array.from({ length: 23 }, (_, i) => `q${i + 1}`),
    );
  });

  it("uses each export header verbatim as the question text", () => {
    for (const [header, qid] of Object.entries(MAY_HEADER_TO_QID)) {
      expect(QUESTION_BY_ID.get(qid)?.text).toBe(header);
    }
  });

  it("keeps the raw header map aligned with the normalised one", () => {
    expect(Object.values(MAY_HEADER_TO_QID_RAW)).toEqual(
      Object.values(MAY_HEADER_TO_QID),
    );
    for (const [raw, qid] of Object.entries(MAY_HEADER_TO_QID_RAW)) {
      expect(MAY_HEADER_TO_QID[normalizeAnswerText(raw)]).toBe(qid);
    }
  });

  it("offers exactly the options respondents actually chose", () => {
    // Every distinct answer in the export must normalise onto a known option.
    // This is what catches a reordered, reworded, or dropped option.
    for (const qid of Object.keys(dist)) {
      const question = QUESTION_BY_ID.get(qid);
      expect(question, `missing question ${qid}`).toBeDefined();
      if (!question?.options) continue;
      for (const answered of Object.keys(dist[qid])) {
        expect(
          question.options,
          `${qid}: "${answered}" is not an offered option`,
        ).toContain(normalizeAnswerText(answered));
      }
    }
  });

  it("scores capability answers 0-4 by option position", () => {
    for (const qid of CAPABILITY_QUESTION_IDS) {
      const q = QUESTION_BY_ID.get(qid);
      expect(q?.kind).toBe("capability");
      expect(q?.options).toHaveLength(5);
    }
  });

  it("orders capability options from least to most capable", () => {
    // Position IS the score, so the first option must be the "I don't know
    // what this is" end. Spot-checked against the anchors in the export.
    expect(QUESTION_BY_ID.get("q2")?.options?.[0]).toContain("don't know");
    expect(QUESTION_BY_ID.get("q3")?.options?.[0]).toContain("don't know");
    expect(QUESTION_BY_ID.get("q5")?.options?.[0]).toContain("don't know");
    expect(QUESTION_BY_ID.get("q6")?.options?.[0]).toContain("don't know");
    expect(QUESTION_BY_ID.get("q2")?.options?.[4]).toContain("other people");
    expect(QUESTION_BY_ID.get("q6")?.options?.[4]).toContain("Others in my team");
  });

  it("keeps the seven radar axes in fixed order with labels", () => {
    expect(CAPABILITY_QUESTION_IDS).toEqual([
      "q1", "q2", "q3", "q4", "q5", "q6", "q7",
    ]);
    for (const qid of CAPABILITY_QUESTION_IDS) {
      expect(CAPABILITY_AXIS_LABEL[qid]).toBeTruthy();
    }
  });

  it("uses the same five Likert options for q9-q15", () => {
    for (const qid of ["q9", "q10", "q11", "q12", "q13", "q14", "q15"]) {
      expect(QUESTION_BY_ID.get(qid)?.options).toEqual(LIKERT_OPTIONS);
    }
  });
});

describe("normalizeAnswerText", () => {
  it("collapses the non-breaking space in q16's Neutral", () => {
    // The export stores "Neutral ". Exact matching would drop 22 answers.
    expect(normalizeAnswerText("Neutral ")).toBe("Neutral");
  });

  it("collapses a non-breaking space in the MIDDLE of q2's option", () => {
    // Harder to spot than a trailing one, and just as fatal.
    const raw =
      "I've created one or two which I use it occasionally. I mostly still paste context into chats.";
    expect(normalizeAnswerText(raw)).toBe(
      "I've created one or two which I use it occasionally. I mostly still paste context into chats.",
    );
    expect(QUESTION_BY_ID.get("q2")?.options).toContain(
      normalizeAnswerText(raw),
    );
  });

  it("folds smart quotes so a re-export from Excel still matches", () => {
    expect(normalizeAnswerText("I’ve heard of them")).toBe(
      "I've heard of them",
    );
  });

  it("is idempotent and leaves clean text alone", () => {
    const clean = "I regularly use Artefacts when they fit the task.";
    expect(normalizeAnswerText(clean)).toBe(clean);
    expect(normalizeAnswerText(normalizeAnswerText(clean))).toBe(clean);
  });
});

describe("compulsory questions", () => {
  it("requires q1-q7, q9-q18 and q19b, and nothing else", () => {
    expect([...REQUIRED_QUESTION_IDS].sort()).toEqual(
      [
        "q1", "q2", "q3", "q4", "q5", "q6", "q7",
        "q9", "q10", "q11", "q12", "q13", "q14", "q15",
        "q16", "q17", "q18", "q19b",
      ].sort(),
    );
  });

  it("never requires a free-text question", () => {
    for (const q of QUESTIONS) {
      if (q.kind === "text") expect(q.required).toBe(false);
    }
  });

  it("keeps q19 free text so mixed May answers stay verbatim", () => {
    // The export holds "5", "10", and prose in the same column. Coercing it
    // would destroy comparability.
    expect(QUESTION_BY_ID.get("q19")?.kind).toBe("text");
    expect(QUESTION_BY_ID.get("q19")?.required).toBe(false);
  });

  it("flags the two questions that did not exist in May", () => {
    expect(QUESTION_BY_ID.get("q19b")?.addedInWave).toBe("cohort_baseline");
    expect(QUESTION_BY_ID.get("q24")?.addedInWave).toBe("cohort_baseline");
    // Everything q1-q23 must be answerable from a May response.
    for (const q of QUESTIONS) {
      if (/^q(\d+)$/.test(q.id) && Number(q.id.slice(1)) <= 23) {
        expect(q.addedInWave).toBeUndefined();
      }
    }
  });
});
