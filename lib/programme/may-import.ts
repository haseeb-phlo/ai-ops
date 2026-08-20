/**
 * Turning a May 2026 export into ai_score_responses rows.
 *
 * The importer keys on COLUMN ORDER (headers 7-29 are q1-q23), which makes a
 * column shift the dangerous failure: a shifted row files q1's answer under
 * q2 and produces plausible-but-wrong scores that no type check would catch.
 * Three defences, in order of how much they'd save you:
 *
 *   1. `checkHeaders` compares the header row against the verified mapping
 *      before anything is parsed.
 *   2. Values are matched against the question's own option list, and
 *      anything unrecognised is REPORTED rather than stored silently.
 *   3. `summariseDistribution` lets the preview screen compare per-question
 *      counts against the committed fixture. A shift cannot survive that.
 */

import {
  MAY_HEADER_TO_QID,
  MAY_QID_BY_COLUMN_ORDER,
  MAY_FIRST_QUESTION_COLUMN,
  QUESTION_BY_ID,
  normalizeAnswerText,
} from "./questions";
import { scoreAnswer, type Answers } from "./score";

/** Sheet column indices (0-based) for the identity columns. */
const COL_EMAIL = 3;
const COL_COMPLETION_TIME = 2;

export type ParsedResponse = {
  email: string;
  completionTime: string;
  answers: Answers;
  /** Values that matched no offered option, for the preview to surface. */
  unmatched: { qid: string; value: string }[];
};

export type HeaderCheck = {
  ok: boolean;
  /** Per-column mismatches between the file and the verified mapping. */
  problems: { column: number; expected: string; found: string }[];
};

/**
 * Verifies the file's header row still matches the mapping we validated
 * against the original export. Run this BEFORE parsing rows - it's the
 * cheapest place to catch a re-export whose columns moved.
 */
export function checkHeaders(headerRow: readonly string[]): HeaderCheck {
  const expectedHeaders = Object.keys(MAY_HEADER_TO_QID);
  const problems: HeaderCheck["problems"] = [];

  expectedHeaders.forEach((expected, i) => {
    const column = MAY_FIRST_QUESTION_COLUMN - 1 + i;
    const found = normalizeAnswerText(headerRow[column] ?? "");
    if (found !== expected) problems.push({ column: column + 1, expected, found });
  });

  return { ok: problems.length === 0, problems };
}

/** Converts one sheet row into a response, or null when it has no email. */
export function rowToResponse(row: readonly string[]): ParsedResponse | null {
  const email = normalizeAnswerText(row[COL_EMAIL] ?? "").toLowerCase();
  if (!email || !email.includes("@")) return null;

  const answers: Answers = {};
  const unmatched: ParsedResponse["unmatched"] = [];

  MAY_QID_BY_COLUMN_ORDER.forEach((qid, i) => {
    const raw = row[MAY_FIRST_QUESTION_COLUMN - 1 + i] ?? "";
    const value = normalizeAnswerText(raw);
    if (value === "") return;

    const question = QUESTION_BY_ID.get(qid);

    // q19 is mixed free text ("5", "10", prose) and is kept VERBATIM for
    // comparability across waves. Never coerce it to a number.
    if (!question?.options) {
      answers[qid] = { value };
      return;
    }

    if (!question.options.includes(value)) {
      // Store it, but flag it. Dropping the answer would quietly shrink the
      // sample; storing it silently would quietly corrupt the scale.
      unmatched.push({ qid, value });
      answers[qid] = { value };
      return;
    }

    const score = scoreAnswer(qid, value);
    answers[qid] = score === null ? { value } : { value, score };
  });

  return {
    email,
    completionTime: row[COL_COMPLETION_TIME] ?? "",
    answers,
    unmatched,
  };
}

/**
 * One response per email, keeping the LATEST by completion time.
 *
 * The May file happens to have no duplicates, but a re-export could, and an
 * upsert in file order would keep whichever row happened to come last rather
 * than the most recent answer.
 */
export function dedupeByCompletionTime(
  responses: readonly ParsedResponse[],
): ParsedResponse[] {
  const byEmail = new Map<string, ParsedResponse>();
  for (const response of responses) {
    const existing = byEmail.get(response.email);
    if (!existing || response.completionTime > existing.completionTime) {
      byEmail.set(response.email, response);
    }
  }
  return [...byEmail.values()];
}

export type ImportPreview = {
  rowCount: number;
  responses: ParsedResponse[];
  duplicatesDropped: number;
  unmatchedCount: number;
  headerCheck: HeaderCheck;
  /** Per-question answer counts, for comparison against the fixture. */
  distribution: Record<string, Record<string, number>>;
};

/** Answer counts per closed question, in the same shape as the test fixture. */
export function summariseDistribution(
  responses: readonly ParsedResponse[],
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const qid of MAY_QID_BY_COLUMN_ORDER) {
    if (!QUESTION_BY_ID.get(qid)?.options) continue;
    const counts: Record<string, number> = {};
    for (const response of responses) {
      const value = response.answers[qid]?.value;
      if (!value) continue;
      counts[value] = (counts[value] ?? 0) + 1;
    }
    out[qid] = counts;
  }
  return out;
}

/** Full parse of a sheet grid, ready for the preview screen. */
export function buildImportPreview(rows: readonly string[][]): ImportPreview {
  const headerCheck = checkHeaders(rows[0] ?? []);
  const parsed = rows
    .slice(1)
    .map(rowToResponse)
    .filter((r): r is ParsedResponse => r !== null);
  const responses = dedupeByCompletionTime(parsed);

  return {
    rowCount: parsed.length,
    responses,
    duplicatesDropped: parsed.length - responses.length,
    unmatchedCount: responses.reduce((n, r) => n + r.unmatched.length, 0),
    headerCheck,
    distribution: summariseDistribution(responses),
  };
}
