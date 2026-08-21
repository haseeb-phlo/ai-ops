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
 * When a response was actually submitted.
 *
 * An .xlsx does not store a date - it stores a NUMBER of days since the 1900
 * epoch, and the "date" you see in Excel is a display format sitting on top
 * of it. The May file's completion times arrive as `46170.50510416667`, which
 * `Date.parse` rejects, so an ISO-only parser silently falls back to "now"
 * and stamps a wave called May 2026 with the date somebody happened to run
 * the import. That is exactly what happened on the first import.
 *
 * The epoch is 1899-12-30, not 1900-01-01: Excel deliberately reproduces a
 * Lotus 1-2-3 bug that treats 1900 as a leap year, and the two-day offset is
 * how you cancel it out. Serials are naive local times with no zone, so they
 * are read as UTC rather than invented into one.
 *
 * Returns null when the value is neither a serial nor a parseable date, so
 * the caller decides what to do rather than getting a wrong answer.
 */
export function parseCompletionTime(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    // Below ~20000 (1954) an "Excel serial" is far more likely to be a stray
    // integer in the wrong column than a real date.
    if (serial < 20000 || serial > 80000) return null;
    const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
    const ms = Math.round(serial * 86_400_000);
    return new Date(EXCEL_EPOCH_UTC + ms).toISOString();
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * One response per email, keeping the LATEST by completion time.
 *
 * The May file happens to have no duplicates, but a re-export could, and an
 * upsert in file order would keep whichever row happened to come last rather
 * than the most recent answer.
 *
 * Compared as parsed instants, not as raw strings: the raw values are Excel
 * serials, and lexically "9" sorts after "46170".
 */
export function dedupeByCompletionTime(
  responses: readonly ParsedResponse[],
): ParsedResponse[] {
  const byEmail = new Map<string, ParsedResponse>();
  for (const response of responses) {
    const existing = byEmail.get(response.email);
    if (!existing) {
      byEmail.set(response.email, response);
      continue;
    }
    const a = parseCompletionTime(response.completionTime);
    const b = parseCompletionTime(existing.completionTime);
    // A row with no usable time never displaces one that has one.
    if (a && (!b || a > b)) byEmail.set(response.email, response);
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
