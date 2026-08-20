import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { columnToIndex, parseCsv, readXlsx } from "@/lib/programme/xlsx";

const fixture = readFileSync(
  resolve(__dirname, "fixtures/sample.xlsx"),
);

/**
 * The fixture is synthetic on purpose: the real May export contains 108
 * employees' free-text answers about their work, which do not belong in git.
 * It reproduces the awkward parts of what Excel emits - namespace prefixes, a
 * self-closing empty cell, a non-breaking space, an inline string, a sparse
 * row, and a stored (uncompressed) entry.
 */

describe("columnToIndex", () => {
  it("handles single and multi-letter references", () => {
    expect(columnToIndex("A")).toBe(1);
    expect(columnToIndex("G")).toBe(7);
    expect(columnToIndex("Z")).toBe(26);
    expect(columnToIndex("AA")).toBe(27);
    expect(columnToIndex("AC")).toBe(29);
  });
});

describe("readXlsx", () => {
  const rows = readXlsx(fixture);

  it("reads every row", () => {
    expect(rows).toHaveLength(4);
  });

  it("resolves shared strings rather than returning their index", () => {
    expect(rows[0][0]).toBe("Email");
    expect(rows[0][1]).toBe("Writing effective prompts");
  });

  it("does NOT let a self-closing empty cell swallow the next one", () => {
    // The regression this test exists for: a `<c ... />` empty cell used to
    // consume the following cell, so its value landed under the wrong column
    // and, being a different cell type, was read as a raw shared-string index
    // (a number) instead of text.
    expect(rows[1][1]).toBe("");
    expect(rows[1][2]).toContain("I've created one or two");
    expect(rows[1][2]).not.toMatch(/^\d+$/);
  });

  it("preserves the non-breaking space exactly as stored", () => {
    // Normalisation is the importer's job, not the reader's - the reader must
    // hand back what the file actually says.
    expect(rows[1][2]).toContain(" ");
    expect(rows[2][0]).toBe("Neutral ");
  });

  it("reads a numeric cell as its literal value", () => {
    expect(rows[2][1]).toBe("42");
  });

  it("reads an inline string", () => {
    expect(rows[2][2]).toBe("inline value");
  });

  it("decodes XML entities", () => {
    expect(rows[0][2]).toBe("Research, Memory & files out");
  });

  it("pads a sparse row so column index equals array index", () => {
    // Row 4 has only column E. A shift here would misfile every answer.
    expect(rows[3]).toEqual(["", "", "", "", "Writing effective prompts"]);
  });

  it("rejects a file that isn't a zip", () => {
    expect(() => readXlsx(Buffer.from("not a spreadsheet"))).toThrow(
      /valid \.xlsx/,
    );
  });
});

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("handles doubled quotes", () => {
    expect(parseCsv('"he said ""hi""",x')).toEqual([['he said "hi"', "x"]]);
  });

  it("handles a newline inside a quoted field", () => {
    // Free-text answers genuinely contain these.
    expect(parseCsv('a,"line one\nline two",c')).toEqual([
      ["a", "line one\nline two", "c"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps empty trailing fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });
});
