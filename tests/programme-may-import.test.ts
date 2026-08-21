import { describe, it, expect } from "vitest";
import {
  buildImportPreview,
  checkHeaders,
  dedupeByCompletionTime,
  parseCompletionTime,
  rowToResponse,
  summariseDistribution,
} from "@/lib/programme/may-import";
import {
  MAY_HEADER_TO_QID,
  MAY_FIRST_QUESTION_COLUMN,
  QUESTION_BY_ID,
} from "@/lib/programme/questions";

const HEADERS = Object.keys(MAY_HEADER_TO_QID);
const opt = (qid: string, i: number) => QUESTION_BY_ID.get(qid)!.options![i];

/** A sheet row with the six identity columns then the 23 answers. */
function makeRow(
  answers: Partial<Record<string, string>>,
  email = "a@wearephlo.com",
  completionTime = "2026-05-14T10:00:00",
): string[] {
  const row: string[] = ["1", "start", completionTime, email, "A Person", "mod"];
  HEADERS.forEach((_, i) => {
    row[MAY_FIRST_QUESTION_COLUMN - 1 + i] = answers[`q${i + 1}`] ?? "";
  });
  return row;
}

const headerRow = (() => {
  const row: string[] = ["ID", "Start time", "Completion time", "Email", "Name", "Last modified time"];
  HEADERS.forEach((h, i) => {
    row[MAY_FIRST_QUESTION_COLUMN - 1 + i] = h;
  });
  return row;
})();

describe("checkHeaders", () => {
  it("accepts the verified header layout", () => {
    expect(checkHeaders(headerRow).ok).toBe(true);
  });

  it("accepts headers carrying a non-breaking space", () => {
    const row = [...headerRow];
    row[6] = "Writing effective prompts";
    expect(checkHeaders(row).ok).toBe(true);
  });

  it("rejects a shifted header row and says which column moved", () => {
    // Someone inserts a column: everything after it slides right.
    const row = [...headerRow];
    row.splice(6, 0, "Some new column");
    const result = checkHeaders(row);
    expect(result.ok).toBe(false);
    expect(result.problems[0].column).toBe(7);
    expect(result.problems[0].expected).toBe("Writing effective prompts");
  });

  it("rejects a renamed question", () => {
    const row = [...headerRow];
    row[7] = "Using Projects";
    const result = checkHeaders(row).problems;
    expect(result).toHaveLength(1);
    expect(result[0].found).toBe("Using Projects");
  });
});

describe("rowToResponse", () => {
  it("lowercases the email and uses it as the identity", () => {
    const r = rowToResponse(makeRow({}, "Alice@WearePhlo.com"));
    expect(r?.email).toBe("alice@wearephlo.com");
  });

  it("skips a row with no usable email", () => {
    expect(rowToResponse(makeRow({}, ""))).toBeNull();
    expect(rowToResponse(makeRow({}, "not-an-email"))).toBeNull();
  });

  it("scores capability answers from their option position", () => {
    const r = rowToResponse(
      makeRow({ q1: opt("q1", 3), q6: opt("q6", 4) }),
    );
    expect(r?.answers.q1.score).toBe(3);
    expect(r?.answers.q6.score).toBe(4);
    expect(r?.unmatched).toEqual([]);
  });

  it("normalises a non-breaking space so the answer still scores", () => {
    // q16's real value is "Neutral " and a q2 option has one mid-string.
    const q2raw =
      "I've created one or two which I use it occasionally. I mostly still paste context into chats.";
    const r = rowToResponse(makeRow({ q2: q2raw, q16: "Neutral " }));
    expect(r?.answers.q2.score).toBe(2);
    expect(r?.answers.q16.value).toBe("Neutral");
    expect(r?.unmatched).toEqual([]);
  });

  it("folds smart quotes from an Excel re-export", () => {
    const r = rowToResponse(
      makeRow({ q2: "I’ve heard of them but haven’t used one." }),
    );
    expect(r?.answers.q2.score).toBe(1);
  });

  it("REPORTS an unrecognised option instead of storing it silently", () => {
    const r = rowToResponse(makeRow({ q2: "Some answer nobody offered" }));
    expect(r?.unmatched).toEqual([
      { qid: "q2", value: "Some answer nobody offered" },
    ]);
    // Still stored, so the row isn't silently shrunk - just flagged.
    expect(r?.answers.q2.value).toBe("Some answer nobody offered");
    expect(r?.answers.q2.score).toBeUndefined();
  });

  it("keeps q19 verbatim and never coerces it to a number", () => {
    const r = rowToResponse(makeRow({ q19: "about 2-3 hours, hard to say" }));
    expect(r?.answers.q19.value).toBe("about 2-3 hours, hard to say");
    expect(r?.answers.q19.score).toBeUndefined();
  });

  it("omits unanswered questions rather than storing empty strings", () => {
    const r = rowToResponse(makeRow({ q1: opt("q1", 0) }));
    expect(r?.answers.q23).toBeUndefined();
    expect(Object.keys(r!.answers)).toEqual(["q1"]);
  });
});

describe("dedupeByCompletionTime", () => {
  it("keeps the latest response per email", () => {
    const early = rowToResponse(
      makeRow({ q1: opt("q1", 0) }, "dup@wearephlo.com", "2026-05-01T09:00:00"),
    )!;
    const late = rowToResponse(
      makeRow({ q1: opt("q1", 4) }, "dup@wearephlo.com", "2026-05-20T09:00:00"),
    )!;
    // File order deliberately puts the OLD one last.
    const result = dedupeByCompletionTime([late, early]);
    expect(result).toHaveLength(1);
    expect(result[0].answers.q1.score).toBe(4);
  });

  it("leaves distinct emails alone", () => {
    const a = rowToResponse(makeRow({}, "a@wearephlo.com"))!;
    const b = rowToResponse(makeRow({}, "b@wearephlo.com"))!;
    expect(dedupeByCompletionTime([a, b])).toHaveLength(2);
  });
});

describe("buildImportPreview", () => {
  const rows = [
    headerRow,
    makeRow({ q1: opt("q1", 2), q2: opt("q2", 1) }, "a@wearephlo.com"),
    makeRow({ q1: opt("q1", 2), q2: opt("q2", 3) }, "b@wearephlo.com"),
    makeRow({ q1: opt("q1", 0) }, "b@wearephlo.com", "2026-05-30T09:00:00"),
    makeRow({}, ""),
  ];
  const preview = buildImportPreview(rows);

  it("counts rows, drops duplicates and skips rows with no email", () => {
    expect(preview.rowCount).toBe(3);
    expect(preview.responses).toHaveLength(2);
    expect(preview.duplicatesDropped).toBe(1);
  });

  it("passes the header check on a well-formed file", () => {
    expect(preview.headerCheck.ok).toBe(true);
  });

  it("summarises the distribution for comparison against ground truth", () => {
    // This is the guard that makes a column shift impossible to miss.
    expect(preview.distribution.q1[opt("q1", 2)]).toBe(1);
    expect(preview.distribution.q1[opt("q1", 0)]).toBe(1);
  });

  it("reports unmatched values across the whole file", () => {
    const withBad = buildImportPreview([
      headerRow,
      makeRow({ q2: "invented" }, "c@wearephlo.com"),
    ]);
    expect(withBad.unmatchedCount).toBe(1);
  });
});

describe("summariseDistribution", () => {
  it("covers closed questions and ignores free text", () => {
    const r = rowToResponse(makeRow({ q1: opt("q1", 1), q19: "5" }))!;
    const dist = summariseDistribution([r]);
    expect(dist.q1[opt("q1", 1)]).toBe(1);
    expect(dist.q19).toBeUndefined();
  });
});

describe("parseCompletionTime", () => {
  it("reads an Excel serial as a real date", () => {
    // The value in the May file's first row. Excel's epoch is 1899-12-30,
    // which is what makes this 28 May rather than 30 May.
    expect(parseCompletionTime("46170.50510416667")).toBe(
      "2026-05-28T12:07:21.000Z",
    );
  });

  it("still reads an ISO string", () => {
    expect(parseCompletionTime("2026-05-28T12:07:21Z")).toBe(
      "2026-05-28T12:07:21.000Z",
    );
  });

  it("returns null rather than guessing", () => {
    expect(parseCompletionTime("")).toBeNull();
    expect(parseCompletionTime("not a date")).toBeNull();
    // A stray row number in the wrong column is not 1900-01-31.
    expect(parseCompletionTime("31")).toBeNull();
  });
});

describe("dedupeByCompletionTime with serials", () => {
  const row = (email: string, completionTime: string) =>
    ({ email, completionTime, answers: {}, unmatched: [] }) as never;

  it("keeps the later serial, which sorts wrong as a string", () => {
    // "9000" > "46170" lexically, so a string compare picks the older row.
    const kept = dedupeByCompletionTime([
      row("a@wearephlo.com", "46170.5"),
      row("a@wearephlo.com", "46100.5"),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].completionTime).toBe("46170.5");
  });

  it("never lets an unparseable time displace a real one", () => {
    const kept = dedupeByCompletionTime([
      row("a@wearephlo.com", "46170.5"),
      row("a@wearephlo.com", ""),
    ]);
    expect(kept[0].completionTime).toBe("46170.5");
  });
});
