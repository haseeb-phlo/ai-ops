---
version: alpha
name: AI Ops design analysis
status: proposal
supersedes: nothing
description: >
  A dense, light-only internal-operations interface. The system is a warm cream
  canvas carrying navy ink, where panels are told apart from the page by a
  hairline rather than a fill, colour is rationed to a single deep-teal accent
  plus a 6px status dot, and every number in the product sets in tabular
  figures. Type runs one family from eyebrow to page title — weight and size
  carry hierarchy, never a second face. Hierarchy comes from a surface ladder
  and hairlines before it comes from shadow; shadow is reserved for things that
  genuinely float. Density is the product: this is a register, a queue and an
  audit log, so surfaces where people compare and act tighten rather than
  breathe.

# ---------------------------------------------------------------------------
# WHAT THIS FILE IS
#
# A merge of four public design-system analyses (a dark project-management
# marketing canvas, a monochrome developer-platform system, a warm editorial
# AI-product site, and a financial-infrastructure brand), redacted of every
# proprietary and licensed element and adapted to this app.
#
# REMOVED as proprietary or licensed: all four source brand names and product
# names; all four signature accent hexes and their named colour ladders; the
# licensed display/text/mono typefaces (two of the four are not publicly
# distributed at all); brand glyphs and wordmarks; the two atmospheric gradient
# mesh systems; source-page URLs.
#
# KEPT, because none of it is proprietary and it is the reason to use these
# files at all: the spacing base and ladder, the radius scale and its role
# assignment, the type scale's sizes / weights / line-heights / tracking, the
# elevation model, the layout and grid rules, the responsive strategy, the
# component anatomies, and every stated design principle.
#
# ADAPTED: the sources are all MARKETING-surface analyses. Roughly 60% of their
# component layer is hero bands, CTA bands, pricing tiers, testimonial cards,
# logo strips, footers and cookie banners, and has no analogue in a sidebar-rail
# ops app. Those entries are replaced by the surfaces this app actually has.
# The token, type, spacing, elevation and principle layers port nearly intact.
#
# This file does NOT supersede anything. The binding spec remains
# `docs/design-system.md` in the sibling gradient repo, and the enforced rules
# remain `.claude/rules/ui-styling.md` + `tests/contrast.test.ts`. Where this
# file and those disagree, they win.
#
# IMPLEMENTED: the eyebrow token and component; the ink-tinted elevation steps;
# tabular figures as a stated rule; the toast primitive and its spine; the
# field/aria-describedby anatomy; horizontal-only padding on fixed-height
# controls; scaled display tracking carried by the lg/xl/2xl size steps rather
# than by a utility; a line-height on --text-3xs, which had none and was
# therefore clipping uppercase glyphs inside tight-leading rows; `leading-normal`
# on wrapping prose; and the reading rung of the text ladder.
# Numbers here were reconciled *down* to the app's real, denser control scale
# rather than the other way round - see Buttons.
#
# NOT implemented, with reasons in Known gaps: a destructive-tint token,
# colour-as-data, and the 48px section rhythm - which this app should not take,
# because 96px-derived spacing on a register and a queue fights the density
# this same file argues for.
# ---------------------------------------------------------------------------

colors:
  # The colour layer is this app's existing contract-tested palette, not an
  # import. `tests/contrast.test.ts` reads these straight out of
  # `app/globals.css` and fails on any raw hex outside the token block, so a
  # borrowed palette would not just be off-brand, it would fail CI.
  primary: "#086a74"
  on-primary: "#ffffff"
  secondary: "#def4f7"
  on-secondary: "#065059"
  ink: "#07073d"
  ink-body: "#313461"
  ink-muted: "#5b6285"
  canvas: "#fcfaf6"
  surface-card: "#ffffff"
  surface-muted: "#ecf0f1"
  hairline: "#e4e6ee"
  input: "#e4e6ee"
  ring: "#00a9be"
  destructive: "#d81e5b"
  destructive-ink: "#b5194c"
  success: "#087a53"
  warning: "#9a6700"
  chart-1: "#0784a2"
  chart-2: "#2f9e63"
  chart-3: "#5560b8"
  chart-4: "#d81e5b"
  chart-5: "#b17a1a"

typography:
  # One family throughout (IBM Plex Sans / Mono). Weights are 400/500/600 only,
  # because `app/layout.tsx` loads exactly those three — Plex is a static
  # family on Google Fonts, so any other weight is synthesised into a faux
  # weight by the browser. This is also why the thin-display idiom from one
  # source (weight 300 display type) is dropped rather than adapted: there is
  # no 300 cut to load.
  eyebrow:
    fontFamily: var(--font-sans)
    fontSize: 11px
    fontWeight: 500
    lineHeight: inherit
    letterSpacing: 0.06em
    textTransform: uppercase
  eyebrow-mono:
    fontFamily: var(--font-mono)
    fontSize: 11px
    fontWeight: 500
    lineHeight: inherit
    letterSpacing: 0.06em
    textTransform: uppercase
  meta:
    fontFamily: var(--font-sans)
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  meta-strong:
    fontFamily: var(--font-sans)
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0
  body:
    fontFamily: var(--font-sans)
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  label:
    fontFamily: var(--font-sans)
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0
  tabular:
    fontFamily: var(--font-sans)
    fontSize: inherit
    fontWeight: inherit
    lineHeight: inherit
    letterSpacing: -0.01em
    fontFeature: tnum
  title-sm:
    fontFamily: var(--font-sans)
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.1px
  title:
    fontFamily: var(--font-sans)
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: -0.2px
  heading:
    fontFamily: var(--font-sans)
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.4px
  page-title:
    fontFamily: var(--font-sans)
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.5px
  code:
    fontFamily: var(--font-mono)
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  # Derived, not chosen: every step is a calc() multiple of --radius (0.5rem),
  # so moving --radius moves all of them. The role assignment below is the
  # merged one — tight radius for functional chrome, a step up for content
  # panels, pill for badges and dots only.
  sm: 4.8px
  md: 6.4px
  lg: 8px
  xl: 11.2px
  2xl: 14.4px
  pill: 9999px
  full: 9999px

spacing:
  # 4px base. All four sources agree on the ladder; they disagree on
  # application, and the dense-product numbers win here (see Layout).
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px

components:
  sidebar-rail:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    borderColor: "{colors.hairline}"
    padding: "{spacing.md}"
  mobile-top-bar:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    borderColor: "{colors.hairline}"
    height: 64px
  nav-link:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
  nav-link-active:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
  detail-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.page-title}"
    borderColor: "{colors.hairline}"
    padding: "{spacing.lg} {spacing.xl}"
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  stat-tile:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.tabular}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  table-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.eyebrow}"
    borderColor: "{colors.hairline}"
    padding: "{spacing.sm} {spacing.md}"
  table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    borderColor: "{colors.hairline}"
    padding: "{spacing.sm} {spacing.md}"
  table-row-selected:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    padding: "{spacing.sm} {spacing.md}"
  status-dot:
    size: 6px
    rounded: "{rounded.full}"
  status-pill:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.pill}"
    padding: "2px {spacing.sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: 32px
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: 32px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 32px
  # The background is the destructive hue at 10%. There is no token for that
  # tint, so this entry references the base hue and the tint is applied at the
  # call site. A `destructive-tint` token would remove the ambiguity, but it
  # needs a contrast run first — see Known gaps.
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: 32px
  field-label:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  field-help:
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
  field-error:
    textColor: "{colors.destructive-ink}"
    typography: "{typography.meta}"
  text-input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.input}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 32px
  segmented-control:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta-strong}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-control-indicator:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.meta-strong}"
    rounded: "{rounded.sm}"
  toast:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
    spineWidth: 2px
  dialog:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  command-palette:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm}"
  board-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.meta}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  empty-state:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: "2px {spacing.sm}"
---

## Overview

This is a register, a queue and an audit log wearing one skin. Almost every
surface is a list of things with a state, a date and a number attached, so the
system is tuned for reading density rather than for persuasion — there is no
hero, no marketing band, no photograph anywhere in the product.

The canvas is a warm cream (`{colors.canvas}`) carrying navy ink
(`{colors.ink}`). The defining structural move is that **the canvas and the
in-page panel are the same colour**: a panel is told apart from the page by its
hairline alone. This is the flat-panel rule, and it is the reason the interface
reads as one continuous sheet of information rather than a stack of floating
boxes. It also means the cream is load-bearing — change it without changing the
panel and the look dies silently, with no error and no failing test.

Colour is rationed hard. A single deep-teal accent (`{colors.primary}`) carries
primary actions, the focus boundary and link emphasis, and nothing else. Status
never washes a surface: the semantic hue appears **only** as a solid 6px dot,
while the label and the pill around it stay ink-on-card. A pale aqua
(`{colors.secondary}`) is the one permitted wash, reserved for brand moments.
Everything else is ink, muted ink, and hairline.

Type runs one family from the 11px uppercase eyebrow to the 24px page title.
Weight and size carry the hierarchy; there is no display face. Every number sets
in tabular figures.

**Key characteristics:**

- **Flat panel.** Canvas and panel share a colour; a 1px hairline is the only
  separator. Shadow is not the default — it is reserved for things that float.
- **One accent, rationed.** Deep teal on primary actions, focus boundary and
  link emphasis. Never a section fill, never decorative.
- **Status is a dot, never a wash.** The semantic hue is confined to 6px.
- **Tabular figures everywhere a number appears.** Counts, ordinals, dates,
  scores, per-week frequencies, percentages.
- **One family, three weights.** 400 body, 500 labels and controls, 600
  headings. No light weight, no italic, no second face.
- **Selection is a surface lift, not a colour fill.**
- **Density by surface.** Compare-and-act surfaces tighten; reading surfaces
  breathe. The chrome's body voice is 12px, not 16px.
- **Light only.** There is no dark mode and no `prefers-color-scheme` query.

## Colors

### Accent

- **Primary** (`{colors.primary}`) — the single chromatic accent. Primary
  buttons, the focus *boundary*, link emphasis, chart-1's near neighbour. It
  clears 6.06:1 on the cream canvas and 6.32:1 on white, which is why it and not
  the decorative aqua carries every focus boundary.
- **Secondary / aqua wash** (`{colors.secondary}`, ink `{colors.on-secondary}`)
  — the one permitted colour wash, for brand moments only. Not for status.
- **Ring** (`{colors.ring}`) — a decorative halo at 2.72:1. **Never a
  boundary.** It sits outside a compliant edge, never instead of one.

### Surface

- **Canvas** (`{colors.canvas}`) — the page floor *and* the in-page panel
  surface. These are deliberately the same value.
- **Card** (`{colors.surface-card}`) — pure white, one step up. Cards that
  genuinely sit above the sheet, the sidebar rail, overlays, toasts.
- **Muted** (`{colors.surface-muted}`) — the inset well: segmented-control
  track, selected row, active nav link.
- **Hairline** (`{colors.hairline}`) — the 1px border on every panel, card,
  input, table row and divider. The structural workhorse of the entire system.

A principle worth stating because it is easy to get backwards: **the hairline is
one elevation step, not an ink line.** It is tinted toward the surface it
separates, not toward the text. A border dark enough to read as a drawn line
turns a calm sheet into a wireframe.

### Text

| Rung | Token | Role |
|---|---|---|
| 1 | `{colors.ink}` | Headings, primary text, table cell values |
| 2 | `{colors.ink-body}` | Running prose on a reading surface |
| 3 | `{colors.ink-muted}` | Secondary text, meta, table labels, captions, help |
| — | *(not possible)* | A fainter placeholder rung drops below 4.5:1 on cream |

The app currently runs a **two-rung** ladder where the sources run four and five.
That is a real gap — two rungs cannot express "this is secondary" and "this is
nearly silent" as different things, which is why muted text gets overloaded.

**The middle rungs are deliberately left unfilled here.** Adding them means
adding hexes, and every pairing in this palette is contrast-asserted in
`tests/contrast.test.ts` in both directions — allowed pairings must clear
4.5:1, forbidden ones must stay below it. Proposing unvalidated values would
either fail CI or, worse, quietly pass as a stale rule. The ladder's *shape* is
the portable part; the values need a contrast run before they land.

### Semantic

- **Success** (`{colors.success}`), **Warning** (`{colors.warning}`),
  **Destructive** (`{colors.destructive}`) — dots, spines, solid marks.
- **Destructive ink** (`{colors.destructive-ink}`) — text on a destructive
  tint *only*. The brand pink is 4.05:1 on its own /10 and 3.45:1 on the /20
  hover, both under AA; this token exists because the obvious choice fails.

### Chart ramp

`{colors.chart-1}` … `{colors.chart-5}`, validated for lightness band, chroma
floor, adjacent-pair CVD separation, and 3:1 contrast on cream. **Assign in
fixed order. Never cycle, never substitute ad-hoc.**

## Typography

### Family

One family, both cuts: a humanist sans for everything and its mono sibling for
code, IDs, and the uppercase eyebrow. The pair was chosen together rather than
separately — both halves carry real tabular figures, which matters because
tabular numerals appear on nearly every number in the product.

**Headings deliberately stay on the body face.** A display face for h1 and a
text face for everything else is the standard way an interface drifts into
looking like two products stapled together, and there is no marketing page here
to justify one. This is the single largest adaptation from the sources: one of
the four builds its entire voice on a licensed serif display face, and that
idiom is dropped whole rather than substituted.

### Hierarchy

| Token | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `{typography.page-title}` | 24px | 600 | 1.25 | -0.5px | The page headline |
| `{typography.heading}` | 20px | 600 | 1.3 | -0.4px | Sub-section headings |
| `{typography.title}` | 18px | 500 | 1.35 | -0.2px | Panel and section titles |
| `{typography.title-sm}` | 16px | 500 | 1.4 | -0.1px | Card titles, list group headers |
| `{typography.label}` | 14px | 500 | 1.43 | 0 | Controls, buttons, field labels |
| `{typography.body}` | 14px | 400 | 1.43 | 0 | Prose, form values, reading surfaces |
| `{typography.meta-strong}` | 12px | 500 | 1.33 | 0 | Emphasised meta, segmented control |
| `{typography.meta}` | 12px | 400 | 1.33 | 0 | The chrome's body voice — table cells, card body |
| `{typography.eyebrow}` | 11px | 500 | inherit | **+0.06em** | Uppercase eyebrows, chips, dense meta |
| `{typography.eyebrow-mono}` | 11px | 500 | inherit | **+0.06em** | The same, on the mono face — IDs, codes, timestamps |
| `{typography.code}` | 12px | 400 | 1.5 | 0 | IDs, code, monospace meta |
| `{typography.tabular}` | inherit | inherit | inherit | -0.01em | Any numeric cell (`tnum`) |

`{typography.heading}` at 20px and `{typography.page-title}` at 24px resolve a
previously deferred decision — the 20px step had exactly one use in the codebase
and no stated role, which is what "deferred" looks like in practice.

### Principles

- **Tracking scales negative with size, and inverts at the eyebrow.** Display
  sizes tighten (-0.5px at 24px down to 0 at body); the 11px uppercase eyebrow
  tracks *positive* at +0.06em. That inversion is deliberate: the eyebrow is
  taxonomy, not headline, and the opposite tracking is what marks it as a
  different kind of text rather than a small one.

  The +0.06em matches what the codebase already does, but it does so as an
  *arbitrary* value (`tracking-[0.06em]`), which the house rules class as drift.
  It wants a named step. Existing eyebrows are also split between weight 500 and
  600; this file picks 500 and that is a change to roughly half the call sites,
  not a description of them.

- **The eyebrow defaults to the sans face, not the mono one.** 66 of the 79
  existing 11px call sites are sans; the mono variant is for IDs, codes and
  timestamps. One source file puts all its section eyebrows on the mono face —
  that is a good idiom, but adopting it here would silently reclassify most of
  the existing eyebrows, so it is offered as `{typography.eyebrow-mono}` rather
  than made the default.
- **Weight is ternary, and the set is closed.** 600 for headings, 500 for
  labels and controls, 400 for everything else. No light weight, no 700, no
  italic. The three loaded weights are exactly these — anything else is
  synthesised by the browser into a faux weight, so the constraint is enforced
  by what is loaded, not just by taste.
- **Bigger before bolder.** When something needs emphasis, take the next size
  step before reaching for the next weight.
- **Tabular figures on every number.** See below — it has its own section
  because it is the highest-value rule in this file.
- **The chrome's body voice is 12px.** This is a dense internal tool, not a
  reading app. 14px is for prose and form values; 12px is for the tables, cards
  and meta that make up most of the surface area.
- **An arbitrary font size is drift, not a decision.** Add a named step instead.

### Tabular figures

Every cell that renders a number — a count, an ordinal, a date, a score, a
per-week frequency, a percentage, a duration — sets in tabular figures, with a
slight tightening of tracking to compensate for the wider default advance.

This is not an import so much as a promotion: tabular numerals already appear
across roughly twenty call sites in the codebase, and the font pair was chosen
partly *because* both cuts carry real tabular figures. What was missing was the
rule. Without it, columns of numbers jitter as digits change width, which is
exactly the kind of defect that never gets filed and never stops being annoying.

Two traps:

- **Right-align numeric columns, left-align text columns.** Tabular figures
  make right-alignment work; without them it looks broken.
- **Do not set tabular figures on running prose.** The wider, uniform advance
  that makes a column scan makes a sentence read worse.

### One note on sizes, deliberately not changed

The scale above maps onto the framework's default steps plus one named 11px
step, rather than redefining those steps to new pixel values. Redefining them is
defensible in the abstract and indefensible here: `text-xs` alone has 427 call
sites. The roles were the missing decision; the numbers were not.

## Layout

### Spacing

- **Base unit: 4px**, with a 2px sub-token for hairline-adjacent work.
- **Tokens:** `{spacing.xxs}` 2 · `{spacing.xs}` 4 · `{spacing.sm}` 8 ·
  `{spacing.md}` 12 · `{spacing.lg}` 16 · `{spacing.xl}` 24 ·
  `{spacing.xxl}` 32 · `{spacing.section}` 48.
- **Section rhythm: 48px**, not the 96px the sources use. This is the single
  most important adaptation in the layout layer. Marketing pages are paced for
  a scroll; an ops surface is paced for a scan, and 96px of air between bands on
  a dashboard means the reader loses the thread between the tile row and the
  table under it.
- **Panel and card interiors: 16px**, stepping to 24px only on reading
  surfaces. The sources sit at 32px throughout; that is a marketing-card number.
- **Table cell padding: 8px vertical, 12px horizontal.**
- **Control padding is horizontal-only** — height comes from an explicit height
  plus line-height, not from vertical padding. This keeps a row of mixed
  controls optically aligned without per-control nudging, and it applies to
  *every* fixed-height control: buttons, inputs, selects and nav links alike.
  Setting both a height and vertical padding on the same control is the bug this
  rule exists to prevent — the two fight, and the text sits off-centre by
  whatever the difference is.

One source makes the density distinction explicitly and it is worth keeping as a
rule rather than a number: **surfaces where people compare and act tighten;
surfaces where people read breathe.** A queue, a board and an audit log are the
first kind. Learn content and long-form detail bodies are the second.

### Grid and container

- Content is full-width within the rail rather than centred in a fixed
  max-width — the sources' ~1200px centred container is a marketing-page
  convention and it wastes the right half of a table on a wide monitor.
- Reading surfaces are the exception: prose caps at roughly 70 characters -
  **but only at `text-sm` and above.** A 65ch measure is defined in `ch`, which
  scales with font-size, so at the chrome's 12px voice it collapses to ~468px
  and leaves 600px of a card empty beside a two-line hint. Below 14px, let text
  fill its container; the container is the measure.
- Card grids run 3-up at desktop, 2-up at tablet, 1-up on mobile.
- Board lanes scroll horizontally rather than compressing below a legible width.

### Whitespace

Whitespace is structural, and the hairline does the work whitespace would
otherwise do. Because the panel and canvas share a colour, the gap between two
panels is *the same surface* — so the separation has to be crisp and small
rather than large and soft. This is the opposite of the cream-canvas source,
where the page floor and card are different tones and the gap can be generous.

## Elevation and depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | 1px `{colors.hairline}`, no shadow | **The default.** Panels, cards, inputs, table rows, dividers |
| 1 — Whisper | Hairline + `0 1px 2px rgba(7,7,61,0.05)` | Cards that genuinely sit above the sheet; the drag-lifted card |
| 2 — Floating | `0 2px 4px rgba(7,7,61,0.06)`, `0 12px 24px -6px rgba(7,7,61,0.10)` + `ring-1` inset hairline | Dialogs, select popups, command palette, toasts, anchored menus |

Three rules the sources converge on, and one they disagree about:

- **Hairline before shadow.** Reach for the border first. A shadow is a claim
  that something floats above the page; most things do not.
- **Colour-block and surface-step before shadow.** A change of surface
  (`{colors.canvas}` → `{colors.surface-card}` → `{colors.surface-muted}`)
  expresses hierarchy more quietly than elevation does.
- **When something does float, layer the shadow finely at low alpha** rather
  than dropping one heavy shadow.
- **Tint the shadow with the ink, not with black.** These values carry the
  navy — pure black shadow on a warm cream canvas reads grey and dirty. One
  source does this and it is the better call.

**Never hand-write the elevation as a `box-shadow` on a focused element.**
`box-shadow` assigns rather than appends, so a hand-rolled focus ring silently
drops the elevation of any floating surface while it is focused. The framework's
ring, inset-ring and shadow utilities compose through separate variables and are
safe together.

### Decorative depth

There is none, and that is the adaptation. Two of the four sources build their
entire decorative system on an atmospheric gradient mesh, and a third leads
every section with a product screenshot. This app has no decorative layer at
all: no gradients, no glows, no spotlight cards, no photography. The data is the
decoration. If a surface looks empty, the answer is better information density,
not an illustration.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 4.8px | Inner chips, the segmented-control indicator |
| `{rounded.md}` | 6.4px | **Buttons, inputs, nav links** — all functional chrome |
| `{rounded.lg}` | 8px | Panels, cards, table containers, toasts |
| `{rounded.xl}` | 11.2px | Dialogs, command palette — surfaces that float |
| `{rounded.2xl}` | 14.4px | Reserved; rare |
| `{rounded.pill}` | 9999px | Status pills, badges, avatars, the status dot |

The radius language is the merged one: **tight radius for functional chrome, one
step up for content panels, another for floating surfaces, pill for badges and
dots only.** Buttons are not pills. Two sources use a full pill for their
primary CTA and both say plainly that the pill marks a *marketing* surface while
the tight square marks the app — this app is all app.

Every step is a `calc()` multiple of a single `--radius`, so the scale moves
together or not at all.

## Components

> Default and active/pressed states only. Variants live as separate entries.
> Marketing components from the source files (hero bands, CTA bands, pricing
> tiers, testimonial cards, logo strips, footers, cookie banners) are omitted
> rather than translated — they have no target in this app.

### Navigation

**`sidebar-rail`** — the primary navigation above the single navigation
breakpoint (48rem). A sticky full-height rail on `{colors.surface-card}` with a
right hairline; collapsible and cookie-persisted.

**`mobile-top-bar`** — below that breakpoint this *is* the navigation; the rail
is absent, not hidden-but-present. 64px tall on `{colors.surface-card}` with a
bottom hairline.

**`nav-link`** / **`nav-link-active`** — inactive is transparent with muted ink;
active lifts to `{colors.surface-muted}` with full ink and a weight step to 500.
**The active state is a surface lift, not a colour fill** — see the principle
below.

**`detail-header`** — the sticky header on a detail route. Canvas background
with a bottom hairline, page title at `{typography.page-title}`, actions right.

### Surfaces

**`panel`** — the workhorse. `{colors.canvas}` background — *the same colour as
the page* — with a 1px hairline and `{rounded.lg}`. The hairline is the only
thing that makes it a panel.

**`card`** — for content that genuinely sits above the sheet.
`{colors.surface-card}` (white), hairline, `{rounded.lg}`, 16px padding.

**`stat-tile`** — a dashboard figure. Card chrome, with the value set large in
`{typography.tabular}` and the label beneath in `{typography.meta}` muted. The
value is the only thing in the tile that gets a size step.

**`empty-state`** — canvas, dashed or solid hairline, 32px padding, muted ink,
a one-line explanation and at most one action. Never an illustration.

### Tables

**`table-header`** — sticky, canvas background, `{typography.eyebrow}` in muted
ink. The sticky header takes a hairline via `inset 0 -1px 0` rather than a
shadow: at a scroll boundary this is a **hairline, not elevation**.

**`table-row`** — canvas, bottom hairline, `{typography.meta}`. Numeric columns
right-aligned in `{typography.tabular}`; text columns left-aligned.

**`table-row-selected`** — lifts to `{colors.surface-muted}`. No accent fill, no
left border, no tint.

### Status

**`status-dot`** — a solid 6px circle in the semantic hue. This is the *only*
place a status colour appears.

**`status-pill`** — the dot plus a label on a card surface with a hairline and a
pill radius. **The pill surface and the label stay ink-on-card**; only the dot
carries the hue. Tinted-wash pills are out of the system.

### Buttons

All four variants share a **32px** height, `{rounded.md}`, `{typography.label}`,
and horizontal-only padding. 32 rather than the 36 the sources use: this app
runs a denser control scale (24 / 28 / 32 / 36 for xs / sm / default / lg) and
adopting the marketing-page height would have cost a row of density on every
table and toolbar in the product. Where a source's number and this app's
deliberate one disagree, the app wins - that is what adapting means.

**`button-primary`** — solid `{colors.primary}`, white label. One per surface.

**`button-secondary`** — white with a hairline and ink label.

**`button-ghost`** — transparent until interacted.

**`button-destructive`** — the quiet destructive: a 10% destructive tint with
the label in `{colors.destructive-ink}`, **not** in `{colors.destructive}`. The
brand pink on its own tint is 4.05:1, under AA at this size and weight.

### Forms

The field anatomy, previously unwritten:

```
field-label        (500, ink)                    ← always present, always above
text-input         (36px, hairline, rounded.md)
field-help         (12px, muted)                 ← optional, below, aria-describedby
field-error        (12px, destructive-ink)       ← replaces help when present, aria-describedby
```

- The label sits **above** the control, never beside it, and never as a
  placeholder. A placeholder is not a label; it disappears exactly when it is
  needed.
- Required is marked on the label, and optional is marked when most fields in
  the form are required — mark the minority either way.
- Help and error both wire to the control through `aria-describedby`. When an
  error is present it replaces the help text rather than stacking under it.
- The error is text, not a colour change. The border may take the destructive
  hue, but a red border alone carries no information for a colourblind reader
  and none at all for a screen reader.
- **Inputs set at 16px below the navigation breakpoint and step down to 14px
  above it.** iOS Safari zooms the viewport on focus for any input under 16px.
  This is why the 16px step must not shrink.

### Focus

One compliant boundary on `{colors.primary}`, one decorative halo in
`{colors.ring}`. Three shapes, chosen by what the control is:

```
focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50
  → the control already has a border to recolour

focus-visible:ring-3 focus-visible:ring-ring/50
focus-visible:inset-ring-2 focus-visible:inset-ring-primary
  → borderless, but a padded box

focus-visible:ring-3 focus-visible:ring-ring/50
focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary
  → a padding-less, text-only target
```

The halo colour is 2.72:1 against the canvas, under the 3:1 that WCAG 1.4.11
requires of a focus indicator. It is therefore **never the whole indicator** —
there is always a `{colors.primary}` edge inside it. Two of the source files
specify a focus ring entirely in their accent hue; that pattern is not portable
to this palette and is not carried over.

Three traps:

- Most primitives carry `outline-none`, which sets the outline *style* to none;
  a later `outline-2` then compiles to `outline-style: none`. This is why the
  third recipe also carries `outline-solid`, and why the second prefers
  `inset-ring`.
- A 2px inset ring on a tight text link lands on the glyphs.
- Keep the whole indicator within ~4px of the border box. Any ancestor with
  `overflow` clips what a child paints outside it, so a focused row inside a
  scrolling panel loses the outer part of its ring. Do not add a ring offset on
  top of a 3px ring.

### Selection and toggles

**`segmented-control`** — a muted inset track carrying an indicator that lifts
to white. The indicator is the only moving part.

This is the general rule, and it is the one principle in this file that most
often gets reintroduced wrongly: **a selected thing lifts to a different
surface; it does not fill with the accent.** Selected rows, active nav links,
the segmented indicator, a chosen tab — all of them step along the surface
ladder. The accent stays on actions. This is the same discipline that keeps
status in a dot, stated generally.

### Overlays

**`dialog`** — white, `{rounded.xl}`, 24px padding, level-2 shadow plus an inset
hairline ring.

**`command-palette`** — white, `{rounded.xl}`, 8px padding, level-2 shadow.

**`toast`** — previously missing from the system. A floating **white** surface
(not canvas) at `{rounded.lg}`, level-2 shadow, with a **2px left spine** in
`{colors.success}` or `{colors.destructive}` carrying the semantic meaning. The
spine is the status-dot rule applied to a rectangle: the hue is confined to a
2px edge and the body stays ink-on-white.

### Motion

The motion budget is closed and small: entry animations on the dialog, the
select popup, the command palette, and the segmented-control indicator. Nothing
else animates.

**Any new overlay needs the same treatment, including the reduced-motion
guard** — in its compound form, so the guard does not depend on the open/closed
attribute keeping a zero-specificity selector.

Drag transitions on the board and the sortable grid are inline styles that CSS
variants cannot reach. They are user-initiated and therefore outside the budget
by intent, not by oversight.

## Do's and Don'ts

### Do

- Keep the canvas and the in-page panel the same colour, and let the hairline do
  the separating.
- Reach for the hairline before the shadow, and the surface step before either.
- Ration the accent to primary actions, the focus boundary and link emphasis.
- Confine every status hue to a 6px dot or a 2px spine.
- Set every number in tabular figures, and right-align numeric columns.
- Express selection as a surface lift.
- Take the next size step before the next weight.
- Track the uppercase eyebrow positive, against the negative-tracked headings.
- Tint shadows with the ink navy.
- Tighten compare-and-act surfaces; let reading surfaces breathe.

### Don't

- Don't add a `dark:` variant. There is no dark mode; those are dead code
  implying a mode that does not exist.
- Don't wash a surface with a status colour. No tinted pills.
- Don't fill a selected state with the accent.
- Don't use the decorative halo colour as a focus boundary — it is under 3:1.
- Don't set the destructive hue as text on its own tint; that is what the
  separate ink token is for.
- Don't introduce a second type family, a display face, or a weight outside
  400/500/600.
- Don't pill-round a button.
- Don't add a decorative layer — no gradients, no glows, no spotlight cards, no
  stock photography.
- Don't write a raw hex or an `rgba()` outside the token block; the contrast
  test fails on it.
- Don't add an arbitrary font size. Add a named step.
- Don't cycle or substitute the chart ramp — assign in fixed order.
- Don't pad a dashboard band to 96px because a marketing system does.

## Responsive behavior

### Breakpoints

**There is one navigation breakpoint at 48rem**, and one dominant *content*
breakpoint at 40rem that has no navigation effect.

| Width | What changes |
|---|---|
| `< 48rem` | The top bar **is** the navigation; the rail is absent. Inputs set at 16px. Card grids 1-up. Board lanes scroll horizontally. |
| `>= 48rem` | The rail appears as a sticky, collapsible, cookie-persisted full-height column; the top bar is gone. Inputs step to 14px. |
| `>= 40rem` | Grid columns, page padding and table density step up. No navigation effect. |

This is deliberately flatter than the four-and-five-breakpoint ladders in the
sources. Marketing pages need fine-grained reflow because their layouts are
compositional; a rail-plus-content ops app has essentially two states.

### Touch targets

- Buttons and controls hold a 36px box with the hit area padded to 44px on
  touch.
- Table rows on touch hold 44px minimum.
- The status dot is never the hit target — the row or the pill is.

### Collapsing

- Card grids reduce columns rather than scaling cards down.
- Tables scroll horizontally inside their own container with the first column
  pinned; the page body never scrolls horizontally.
- Board lanes scroll rather than compress below a legible card width.
- Long detail bodies keep their reading measure at every width.

## Z-index

Five layers, named for what lives there. Don't renumber to tidy them.

| Layer | Lives there |
|---|---|
| `z-10` in-flow | Sticky table headers, pinned first columns, sticky panel headers, the drag-lifted card |
| `z-20` anchored popover | Tag input, people picker, suggestion lists; the drag handle |
| `z-30` page chrome | The sticky detail header |
| `z-40` app banner | The impersonation banner — must sit above page chrome and never be covered |
| `z-50` overlay | Dialog, select popup, command palette, view-as menu, toast |

## Iteration guide

1. Work on ONE component at a time and reference it by its `components:` key.
2. Decide first which surface it lives on — canvas, card, or muted well.
3. Reach for hairline, then surface step, then shadow, in that order.
4. Default body to `{typography.meta}` (12px) on chrome surfaces and
   `{typography.body}` (14px) on reading surfaces.
5. Any numeric content gets `{typography.tabular}`.
6. Variants live as separate `components:` entries (`-active`, `-selected`,
   `-focused`), never as inline overrides.
7. Use token references everywhere. Never an inline hex.
8. Run `npm run test` after touching a token — the contrast suite reads the
   palette straight out of the stylesheet and asserts both directions.

## Known gaps

- **This file is a proposal and supersedes nothing.** The binding spec remains
  the shared `docs/design-system.md` in the sibling repo; the enforced rules
  remain `.claude/rules/ui-styling.md` and `tests/contrast.test.ts`. Adopting
  this file means reconciling the three, not just merging this one in.
- **Hover states are undocumented**, in this file and in all four sources.
  Default and active/pressed only.
- ~~The text ladder is two rungs.~~ **Three now**, with the reading rung
  (`--body-foreground`) validated and consumed by the `max-w-prose` paragraphs.
  A fourth, fainter rung is not available in this palette: anything lighter than
  the meta grey fails 4.5:1 on cream.
- **There is no token for the destructive tint.** `button-destructive` fills
  with the destructive hue at 10% and that alpha is applied at the call site
  rather than named. A `destructive-tint` token would remove the ambiguity, but
  like the text-ladder rungs it needs a contrast run before it lands.
- ~~The toast spec has no implementation.~~ **Built** as
  `components/ui/toast.tsx`; `redirect-toast.tsx` now composes it.
- **Colour-as-data has no consumer yet.** The rule exists in the shared spec — a
  matrix, diff or heatmap **may** wash a surface, from the categorical ramp
  only, mixed toward `transparent` and never toward the canvas, with the text
  staying ink or a link — but nothing in the app uses it.
- **The source material is entirely marketing-surface analysis.** All four files
  describe public marketing sites; one states outright that the product surface
  is out of scope. Everything here about tables, boards, audit rows, rails and
  dense chrome is adapted rather than observed, and should be treated as a
  proposal tested against this app rather than as an extracted spec.
- **One source file arrived with foreign text spliced into a YAML value**,
  corrupting one type token. It was excluded rather than interpreted. That file's
  provenance should be treated as uncertain.
