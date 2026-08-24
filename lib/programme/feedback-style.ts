/**
 * House style for written feedback, checked and where safe corrected.
 *
 * The feedback a member reads is the only part of an automatic review that is
 * prose, so it is the only part that can read as machine-written. Four rules,
 * all of them Phlo's: British English, no em dashes, no Oxford comma, and
 * none of the padding that makes text sound generated.
 *
 * THE ORDER MATTERS, because the three kinds of violation deserve different
 * treatment:
 *
 *   1. Mechanical and unambiguous - an em dash, "optimize", "color". Fixed in
 *      place. There is no judgement involved and no way to be wrong.
 *   2. Mechanical but context-dependent - the Oxford comma. Only removed when
 *      the sentence is unmistakably a list, because ", and" is also an
 *      ordinary clause join and stripping it there would break the sentence.
 *   3. Not mechanical at all - slop. Reported, never rewritten, because the
 *      fix is different words rather than fewer characters. The caller's move
 *      is to ask the model again with the offending phrase named.
 *
 * `program` is deliberately absent from the spelling map: in this codebase it
 * is as likely to mean software as to be an Americanism, and a wrong "fix"
 * is worse than a missed one.
 */

export type StyleViolation = {
  rule: "em_dash" | "oxford_comma" | "americanism" | "slop";
  /** The offending text, for naming it back to the model. */
  found: string;
  /** Whether applyStyleFixes can deal with it. */
  fixable: boolean;
};

/* ------------------------------------------------------------------ */
/* American to British                                                 */
/* ------------------------------------------------------------------ */

/**
 * Only words where the British form is unambiguous. Each entry is applied
 * case-insensitively with the original capitalisation preserved.
 */
const SPELLINGS: [string, string][] = [
  ["organize", "organise"],
  ["organized", "organised"],
  ["organizing", "organising"],
  ["prioritize", "prioritise"],
  ["prioritized", "prioritised"],
  ["summarize", "summarise"],
  ["summarized", "summarise"],
  ["optimize", "optimise"],
  ["optimized", "optimised"],
  ["optimizing", "optimising"],
  ["recognize", "recognise"],
  ["recognized", "recognised"],
  ["utilize", "utilise"],
  ["standardize", "standardise"],
  ["customize", "customise"],
  ["customized", "customised"],
  ["specialize", "specialise"],
  ["minimize", "minimise"],
  ["maximize", "maximise"],
  ["analyze", "analyse"],
  ["analyzed", "analysed"],
  ["analyzing", "analysing"],
  ["color", "colour"],
  ["colors", "colours"],
  ["behavior", "behaviour"],
  ["behaviors", "behaviours"],
  ["favor", "favour"],
  ["labor", "labour"],
  ["center", "centre"],
  ["centered", "centred"],
  ["defense", "defence"],
  ["license", "licence"],
  ["catalog", "catalogue"],
  ["gray", "grey"],
  ["fulfill", "fulfil"],
  ["fulfilled", "fulfilled"],
  ["enrollment", "enrolment"],
  ["skillful", "skilful"],
  ["traveled", "travelled"],
  ["canceled", "cancelled"],
  ["modeling", "modelling"],
  ["labeled", "labelled"],
];

/* ------------------------------------------------------------------ */
/* Slop                                                                */
/* ------------------------------------------------------------------ */

/**
 * Phrases that mark text as generated rather than written.
 *
 * Two families: the vocabulary tics ("delve", "leverage", "robust") and the
 * structural padding that says nothing ("it's worth noting", "Overall,",
 * "Great job!"). Feedback here is two or three sentences, so there is no
 * legitimate room for any of it.
 */
const SLOP = [
  "delve",
  "leverage",
  "robust",
  "seamless",
  "seamlessly",
  "game-changer",
  "game changer",
  "unlock the",
  "elevate",
  "dive into",
  "deep dive",
  "tapestry",
  "testament to",
  "navigate the complexities",
  "in today's fast-paced",
  "in the world of",
  "it's worth noting",
  "it is worth noting",
  "it's important to note",
  "it is important to note",
  "furthermore",
  "moreover",
  "in conclusion",
  "overall,",
  "that said,",
  "at the end of the day",
  "i hope this helps",
  "great job",
  "excellent work",
  "fantastic work",
  "well done!",
  "keep up the",
  "you're on the right track",
  "not only",
  "a great example of",
  "this is a solid",
  "kudos",
];

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

/**
 * A list comma, as opposed to a comma joining two clauses.
 *
 * "a, b, and c" is a list. "I ran the report, and it worked" is not, and the
 * difference is whether what follows "and" is a clause. The test used here is
 * deliberately narrow: at least two commas before the ", and", and the words
 * after it contain no verb-looking pronoun-plus-word opener. Narrow means it
 * misses some real Oxford commas, which costs a regeneration; wide would mean
 * breaking correct sentences, which costs a reader.
 *
 * ITEMS MAY NOT CROSS A SENTENCE BOUNDARY, and may not run long. Without
 * that, `[^,]+` happily spans full stops and swallows two sentences, so a
 * comma in one and an "or" in the next read as a single list - and the fix
 * then deletes a comma that was doing real work. Found by the live eval on
 * 24 Aug 2026, on feedback of exactly that shape: a genuine list in the first
 * sentence and an ordinary "..., or when..." in the second.
 */
const LIST_ITEM = "[^,.;:!?\\n]{1,60}";
const OXFORD = new RegExp(
  `(${LIST_ITEM}),\\s*(${LIST_ITEM}),\\s+(and|or)\\s+`,
  "gi",
);
const CLAUSE_AFTER = /^(?:and|or)\s+(?:i|you|it|they|we|he|she|this|that|there)\b/i;
/**
 * A list item never opens with a conjunction.
 *
 * "a, b, and c" has "b" in the middle. "X, and Y, or Z" has "and Y" there,
 * which is the tell that the first comma joined clauses rather than
 * separating items - so the trailing comma is a pause, not an Oxford comma,
 * and removing it changes the sentence.
 */
const ITEM_OPENS_WITH_CONJUNCTION = /^\s*(?:and|or|but|so|yet|because|which)\b/i;

export function findOxfordCommas(text: string): string[] {
  const hits: string[] = [];
  for (const match of text.matchAll(OXFORD)) {
    const [whole, , second, conjunction] = match;
    if (ITEM_OPENS_WITH_CONJUNCTION.test(second)) continue;
    const after = text.slice(match.index + whole.length);
    if (CLAUSE_AFTER.test(`${conjunction} ${after}`)) continue;
    hits.push(whole.trim());
  }
  return hits;
}

export function findStyleViolations(text: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  if (!text) return violations;

  // U+2014 and U+2013, matched by escape rather than by literal so a sweep
  // for stray dashes in this repo cannot mangle the detector itself. The
  // repo's own no-em-dash test would otherwise fail on this file.
  for (const match of text.matchAll(/[\u2013\u2014]/g)) {
    violations.push({ rule: "em_dash", found: match[0], fixable: true });
  }

  const lower = text.toLowerCase();
  for (const [american] of SPELLINGS) {
    if (new RegExp(`\\b${american}\\b`, "i").test(text)) {
      violations.push({ rule: "americanism", found: american, fixable: true });
    }
  }

  for (const hit of findOxfordCommas(text)) {
    violations.push({ rule: "oxford_comma", found: hit, fixable: true });
  }

  for (const phrase of SLOP) {
    if (lower.includes(phrase)) {
      violations.push({ rule: "slop", found: phrase, fixable: false });
    }
  }

  return violations;
}

/* ------------------------------------------------------------------ */
/* Correction                                                          */
/* ------------------------------------------------------------------ */

function matchCase(replacement: string, original: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Applies every fix that cannot be wrong. Slop is left alone by design - see
 * the module docblock.
 */
export function applyStyleFixes(text: string): string {
  if (!text) return text;
  let out = text;

  // A dash becomes a spaced hyphen whether or not it had spaces around it,
  // which is how this codebase writes them.
  out = out.replace(/\s*[\u2013\u2014]\s*/g, " - ");

  for (const [american, british] of SPELLINGS) {
    out = out.replace(
      new RegExp(`\\b${american}\\b`, "gi"),
      (m) => matchCase(british, m),
    );
  }

  // Oxford comma: only where findOxfordCommas judged it a list.
  for (const hit of findOxfordCommas(out)) {
    const fixed = hit.replace(/,\s+(and|or)\s*$/i, " $1 ");
    out = out.replace(hit, fixed.trimEnd() + " ");
  }

  return out.replace(/\s{2,}/g, " ").trim();
}

/** Names the violations back to the model, so a retry has something to act on. */
export function describeViolations(violations: readonly StyleViolation[]): string {
  const byRule = new Map<string, string[]>();
  for (const v of violations) {
    byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v.found]);
  }
  const parts: string[] = [];
  const slop = byRule.get("slop");
  if (slop) parts.push(`remove the filler: ${[...new Set(slop)].join(", ")}`);
  if (byRule.has("em_dash")) parts.push("use - rather than an em dash");
  const american = byRule.get("americanism");
  if (american) {
    parts.push(`use British spelling for: ${[...new Set(american)].join(", ")}`);
  }
  if (byRule.has("oxford_comma")) {
    parts.push("drop the comma before the final and in a list");
  }
  return parts.join("; ");
}

/** True when nothing is left that a retry could improve. */
export function isCleanStyle(text: string): boolean {
  return findStyleViolations(text).length === 0;
}
