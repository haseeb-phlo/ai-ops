import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * House style: hyphens, never em or en dashes.
 *
 * Checked across the whole programme feature rather than trusted, because a
 * single pasted sentence reintroduces one and nothing else would notice. The
 * quiz has its own narrower version of this test; this is the safety net for
 * every other string, including copy nobody thought of as "content".
 */

const ROOT = resolve(__dirname, "..");
const TARGETS = ["lib/programme", "app/(protected)/learn"];
const EXTENSIONS = [".ts", ".tsx", ".json"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

describe("no em dashes anywhere in the programme", () => {
  const files = TARGETS.flatMap((t) => walk(join(ROOT, t)));

  it("scans a meaningful number of files", () => {
    // Guards against the walk silently finding nothing and the suite passing
    // for the wrong reason.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.replace(`${ROOT}/`, ""), f]))(
    "%s",
    (_label, path) => {
      const text = readFileSync(path, "utf8");
      const offenders = [...text.matchAll(/.{0,40}[–—].{0,40}/g)].map(
        (m) => m[0].trim(),
      );
      expect(offenders, offenders.join("\n")).toEqual([]);
    },
  );
});
