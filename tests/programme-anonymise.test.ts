import { describe, it, expect } from "vitest";
import {
  buildWorkSampleCsv,
  csvField,
  FORBIDDEN_EXPORT_HEADERS,
  memberKey,
  toCsv,
} from "@/lib/programme/anonymise";

describe("memberKey", () => {
  it("is stable for the same member", () => {
    // A "before" and an "after" must pair up across two separate exports.
    const id = "3f1c9e2a-0000-4000-8000-000000000001";
    expect(memberKey(id)).toBe(memberKey(id));
  });

  it("differs between members", () => {
    expect(memberKey("a")).not.toBe(memberKey("b"));
  });

  it("is short enough to read in a spreadsheet", () => {
    expect(memberKey("a")).toHaveLength(12);
    expect(memberKey("a")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("does not leak the input", () => {
    const id = "3f1c9e2a-0000-4000-8000-000000000001";
    expect(memberKey(id)).not.toContain(id.slice(0, 8));
  });
});

describe("CSV writing", () => {
  it("quotes every field", () => {
    expect(csvField("plain")).toBe('"plain"');
  });

  it("escapes embedded quotes", () => {
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("survives a comma and a newline in free text", () => {
    // Prompt text genuinely contains both.
    expect(csvField("a,b\nc")).toBe('"a,b\nc"');
  });

  it("renders null as an empty field", () => {
    expect(csvField(null)).toBe('""');
  });

  it("joins rows", () => {
    expect(toCsv([["a", "b"], ["c", null]])).toBe('"a","b"\n"c",""');
  });
});

describe("export safety", () => {
  it("names the columns that must never appear", () => {
    expect(FORBIDDEN_EXPORT_HEADERS).toContain("email");
    expect(FORBIDDEN_EXPORT_HEADERS).toContain("name");
    expect(FORBIDDEN_EXPORT_HEADERS).toContain("team");
  });

  it("produces a header row with no identifying column", () => {
    const header = ["member_key", "pre_ref", "post_ref"];
    for (const forbidden of FORBIDDEN_EXPORT_HEADERS) {
      expect(header).not.toContain(forbidden);
    }
  });
});

describe("buildWorkSampleCsv", () => {
  const pairs = [
    {
      cohortMemberId: "3f1c9e2a-0000-4000-8000-000000000001",
      preRef: "https://example.com/before",
      postRef: "https://example.com/after",
    },
    {
      cohortMemberId: "3f1c9e2a-0000-4000-8000-000000000002",
      preRef: null,
      postRef: null,
    },
  ];
  const csv = buildWorkSampleCsv(pairs);

  it("emits exactly three columns", () => {
    expect(csv.split("\n")[0]).toBe('"member_key","pre_ref","post_ref"');
  });

  it("emits one row per member plus the header", () => {
    expect(csv.split("\n")).toHaveLength(3);
  });

  it("contains NO identifying column", () => {
    const header = csv.split("\n")[0].toLowerCase();
    for (const forbidden of FORBIDDEN_EXPORT_HEADERS) {
      expect(header).not.toContain(forbidden);
    }
  });

  it("never leaks the raw member id", () => {
    // The scorer must not be able to join this back to a person.
    for (const pair of pairs) {
      expect(csv).not.toContain(pair.cohortMemberId);
    }
  });

  it("pairs a before and after under the same key", () => {
    // The whole point: the scorer compares two samples without knowing whose.
    const row = csv.split("\n")[1];
    const key = row.split(",")[0];
    expect(key).toBe(`"${memberKey(pairs[0].cohortMemberId)}"`);
    expect(row).toContain("before");
    expect(row).toContain("after");
  });

  it("renders a missing sample as an empty field, not the word null", () => {
    expect(csv.split("\n")[2]).toMatch(/,"",""$/);
  });
});
