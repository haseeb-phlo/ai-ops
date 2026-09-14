/**
 * Contrast check for the design system's palette.
 *
 * Ported from `scripts/contrast.ts` in the gradient repo, which is the same
 * check against the same rules; the shared rules live in that repo's
 * `docs/design-system.md` and bind both apps. Runs here as a vitest test rather
 * than a standalone script so `npm run test` is the gate — this repo has no CI
 * yet, and a check nothing runs is prose with extra steps.
 *
 * Tokens are read out of `app/globals.css` rather than restated, so this cannot
 * drift from the palette it checks: change a hex there and the numbers here move
 * with it. Every allowed pair below is a combination something actually renders.
 * A palette is only accessible in the combinations the design system permits,
 * and checking pairs nothing renders proves nothing.
 *
 * Three things are asserted:
 *   1. every pairing the rules allow meets 4.5:1, or 3:1 for non-text;
 *   2. every pairing the rules forbid is still below 4.5:1, so a palette change
 *      that quietly makes one safe fails here as STALE rather than passing
 *      unnoticed — that is the half a naive port drops;
 *   3. no raw hex and no rgba() outside the token block.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = "app/globals.css";

type Rgb = [number, number, number];

const parseHex = (h: string): Rgb => {
  let s = h.trim().replace("#", "");
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  return [0, 2, 4].map((i) => Number.parseInt(s.slice(i, i + 2), 16)) as Rgb;
};

/** WCAG relative luminance. */
const luminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Composite `fg` at `alpha` over `bg` - what a Tailwind `/N` tint renders as.
 * Tints mix toward transparent, never toward `--background`, so the same
 * utility has to be checked over both surfaces it can land on.
 */
const over = (fg: string, alpha: number, bg: string): string => {
  const [f, b] = [parseHex(fg), parseHex(bg)];
  return `#${f
    .map((v, i) =>
      Math.round(alpha * v + (1 - alpha) * b[i])
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const css = readFileSync(CSS, "utf8");
const rootStart = css.indexOf(":root");
const rootEnd = css.indexOf("\n}", rootStart);
const tokens = new Map<string, string>();
for (const [, name, value] of css
  .slice(rootStart, rootEnd)
  .matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens.set(name, value);
}

const t = (name: string): string => {
  const value = tokens.get(name);
  if (!value)
    throw new Error(`${CSS} has no hex token ${name} - was it renamed?`);
  return value;
};

const BG = t("--background");
const CARD = t("--card");

/* Every tinted surface below uses an alpha this codebase actually renders:
   muted/40 is the dominant hover wash (48 uses), secondary/60 and /80 the
   sidebar's active row, destructive/5, /10 and /20 the quiet-destructive
   button and its hover, primary/85 the solid button's hover. */
const ALLOWED: [label: string, fg: string, bg: string, min: number][] = [
  // Ink on the two surfaces it is allowed to sit on.
  ["foreground on background", t("--foreground"), BG, 4.5],
  ["foreground on card", t("--foreground"), CARD, 4.5],
  // The reading rung. It sits between foreground and muted-foreground, so it
  // is asserted on every surface running prose can land on - including --muted,
  // which the meta grey above is only just cleared for.
  ["body-foreground on background", t("--body-foreground"), BG, 4.5],
  ["body-foreground on card", t("--body-foreground"), CARD, 4.5],
  ["body-foreground on muted", t("--body-foreground"), t("--muted"), 4.5],
  [
    "body-foreground on muted/40 (cream)",
    t("--body-foreground"),
    over(t("--muted"), 0.4, BG),
    4.5,
  ],
  ["muted-foreground on background", t("--muted-foreground"), BG, 4.5],
  ["muted-foreground on card", t("--muted-foreground"), CARD, 4.5],
  ["muted-foreground on muted", t("--muted-foreground"), t("--muted"), 4.5],
  [
    "muted-foreground on muted/40 (cream)",
    t("--muted-foreground"),
    over(t("--muted"), 0.4, BG),
    4.5,
  ],
  [
    "muted-foreground on muted/40 (white)",
    t("--muted-foreground"),
    over(t("--muted"), 0.4, CARD),
    4.5,
  ],
  ["primary on background", t("--primary"), BG, 4.5],
  ["primary on card", t("--primary"), CARD, 4.5],
  ["primary-foreground on primary", t("--primary-foreground"), t("--primary"), 4.5],
  [
    "primary-foreground on primary/85 (hover)",
    t("--primary-foreground"),
    over(t("--primary"), 0.85, BG),
    4.5,
  ],
  // The sidebar's active row: an aqua wash with a teal label.
  [
    "primary on secondary/60",
    t("--primary"),
    over(t("--secondary"), 0.6, BG),
    4.5,
  ],
  [
    "secondary-foreground on secondary",
    t("--secondary-foreground"),
    t("--secondary"),
    4.5,
  ],
  // ::selection inverts to the aqua tint rather than a brand fill.
  [
    "secondary-foreground on secondary (selection)",
    t("--secondary-foreground"),
    t("--secondary"),
    4.5,
  ],
  // Semantic text, on cream and on white. Never on a muted fill (see FORBIDDEN).
  ["success on background", t("--success"), BG, 4.5],
  ["success on card", t("--success"), CARD, 4.5],
  ["warning on background", t("--warning"), BG, 4.5],
  ["warning on card", t("--warning"), CARD, 4.5],
  ["destructive on background", t("--destructive"), BG, 4.5],
  ["destructive on card", t("--destructive"), CARD, 4.5],
  // The one tinted surface a semantic hue is allowed: the quiet-destructive
  // button and the inline error panel. --destructive-ink exists because
  // --destructive itself fails on its own tint at every one of these alphas.
  ...([0.05, 0.1, 0.2] as const).flatMap(
    (a) =>
      [
        [
          `destructive-ink on destructive/${a * 100} (cream)`,
          t("--destructive-ink"),
          over(t("--destructive"), a, BG),
          4.5,
        ],
        [
          `destructive-ink on destructive/${a * 100} (white)`,
          t("--destructive-ink"),
          over(t("--destructive"), a, CARD),
          4.5,
        ],
      ] as [string, string, string, number][],
  ),
  // The impersonation banner: a warning wash read as a surface, with ink text.
  [
    "foreground on warning/10",
    t("--foreground"),
    over(t("--warning"), 0.1, BG),
    4.5,
  ],
  // Colour as data: a matrix or heatmap cell may wash its surface, but the text
  // in it stays ink or a link, never the state's hue. Fills come off the
  // categorical ramp so a drifted cell can never read as a destructive one.
  [
    "primary on chart-2/14 (data-positive)",
    t("--primary"),
    over(t("--chart-2"), 0.14, BG),
    4.5,
  ],
  [
    "primary on chart-5/18 (data-attention)",
    t("--primary"),
    over(t("--chart-5"), 0.18, BG),
    4.5,
  ],
  [
    "foreground on chart-2/14 (data-positive)",
    t("--foreground"),
    over(t("--chart-2"), 0.14, BG),
    4.5,
  ],
  [
    "foreground on chart-5/18 (data-attention)",
    t("--foreground"),
    over(t("--chart-5"), 0.18, BG),
    4.5,
  ],
  // Non-text, 3:1. Dots, spines, chart marks, and the focus boundary - which is
  // why the boundary is --primary and not --ring (see the report below).
  ["focus boundary (primary) on background", t("--primary"), BG, 3],
  ["focus boundary (primary) on card", t("--primary"), CARD, 3],
  ["success dot on card", t("--success"), CARD, 3],
  ["warning dot on card", t("--warning"), CARD, 3],
  ["destructive dot on card", t("--destructive"), CARD, 3],
  ["muted-foreground dot on card", t("--muted-foreground"), CARD, 3],
  ...(["1", "2", "3", "4", "5"] as const).map(
    (n) =>
      [`chart-${n} on background`, t(`--chart-${n}`), BG, 3] as [
        string,
        string,
        string,
        number,
      ],
  ),
];

/* Combinations the rules forbid, asserted as forbidden rather than left as
   prose. Each one is a mistake that is easy to make and reads as fine. If a
   future palette makes one safe, the rule can relax - but it has to be a
   decision, and a silent pass here would be the only warning that nobody made
   it. */
const FORBIDDEN: [label: string, ratio: () => number][] = [
  [
    "warning text on a muted fill",
    () => contrast(t("--warning"), t("--muted")),
  ],
  [
    "warning text on its own data fill",
    () => contrast(t("--warning"), over(t("--chart-5"), 0.18, BG)),
  ],
  [
    "success text on its own data fill",
    () => contrast(t("--success"), over(t("--chart-2"), 0.14, BG)),
  ],
  [
    "destructive text on its own /10 tint",
    () => contrast(t("--destructive"), over(t("--destructive"), 0.1, BG)),
  ],
  [
    "destructive text on its own /20 tint (the button's hover)",
    () => contrast(t("--destructive"), over(t("--destructive"), 0.2, BG)),
  ],
  [
    "ring as a focus boundary on cream",
    () => contrast(t("--ring"), BG),
  ],
  [
    "ring as a focus boundary on white",
    () => contrast(t("--ring"), CARD),
  ],
];

describe("palette contrast", () => {
  it.each(ALLOWED)("%s clears %s:1", (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  /* The ring fails 3:1 by design - it is a decorative halo, kept for the look,
     which is why the compliant boundary sits on --primary. Asserting it stays
     below is what stops someone "fixing" the recipe back onto --ring after a
     palette change makes the number look survivable. */
  it.each(FORBIDDEN)("%s is still below 4.5:1", (_label, ratio) => {
    expect(ratio()).toBeLessThan(4.5);
  });
});

describe("no raw colour outside the token block", () => {
  const outsideRoot = css.slice(0, rootStart) + css.slice(rootEnd);

  it("has no raw hex", () => {
    const stray = [
      ...new Set([...outsideRoot.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])),
    ];
    expect(
      stray,
      "Move each into :root under a semantic name, or reuse the token that already means it.",
    ).toEqual([]);
  });

  /* Zero today, so this guards the state rather than reporting a backlog.
     Prefer color-mix(in srgb, var(--token) N%, transparent) so a tint keeps
     whichever surface it lands on. */
  it("has no rgba() literals", () => {
    expect([...outsideRoot.matchAll(/rgba?\(/g)].length).toBe(0);
  });
});
