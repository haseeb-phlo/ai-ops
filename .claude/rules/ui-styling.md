---
paths:
  - "app/**/*.tsx"
  - "app/*.tsx"
  - "components/**/*.tsx"
  - "components/*.tsx"
  - "app/globals.css"
---

# Styling and UI primitives

Tailwind v4 via `@tailwindcss/postcss`. There is no `tailwind.config` - v4 is config-less, and all customization lives in `app/globals.css`.

shadcn/ui is configured (`components.json`, style `base-nova`, RSC enabled, lucide icons). Primitives are in `components/ui/` with the `cn` helper at `@/lib/utils`. Extend those rather than starting a parallel component library. `components/comments/` holds the shared comment composer and row: the Server Action arrives as a prop from the owning Server Component and the resource id travels in a hidden field.

**The palette is the Phlo brand and it is deliberate.** `app/globals.css` defines one `:root` block lifted from wearephlo.com - warm cream canvas (`#fcfaf6`), navy ink, deep-teal primary, pale-aqua `secondary`, pink `destructive` - mapped to semantic tokens through `@theme inline`. Style with the tokens (`bg-card`, `text-muted-foreground`, `border-border`), never raw hexes or arbitrary Tailwind colors.

Three constraints that are easy to violate by reflex:

- **No dark mode.** There is no `.dark` block and no `prefers-color-scheme` query - the app is light-only. Don't add `dark:` variants; they're dead code implying a mode that doesn't exist.
- **Status colour lives in a dot, never a wash.** `lib/status.ts` sets the grammar: the semantic hue appears *only* as a solid 6px dot (`dotClassName`) while labels and pill surfaces stay ink-on-card. Render `<span className={cn("size-1.5 rounded-full", dotClassName)} />` + label, or use `<StatusPill>` from `components/ui/status-pill.tsx`. Tinted-wash pills (`bg-x-50 text-x-800 border-x-200`) are out; colour washes are reserved for brand aqua on brand moments.
- **Chart colours are a fixed-order ramp.** `--chart-1` … `--chart-5` are validated for lightness band, chroma floor, adjacent-pair CVD separation, and 3:1 contrast on cream. Assign in order; never cycle or substitute ad-hoc colours.
- **Display tracking lives on the size step, not in a utility.** `--text-lg`,
  `--text-xl` and `--text-2xl` each carry a scaled `--letter-spacing`
  (-0.011em / -0.02em / -0.021em), so every use of those sizes is tracked
  without anyone remembering a class. `tracking-tight` is a flat -0.025em and
  is now reserved for **`text-sm` headings**, where it marks a heading apart
  from body copy at the same size (58 sites). `text-base` is left untracked -
  it is the input size, held at 16px so iOS Safari does not zoom on focus.
- **`max-w-prose` is for `text-sm` prose only - never on `text-xs`.** It is
  65**ch**, and `ch` scales with font-size, so at 12px it collapses to about
  468px. Inside a card on a `max-w-6xl` page that is ~44% of the available
  width: a one-sentence hint wraps to two lines with 600px of empty space beside
  it, which reads as broken rather than as a reading measure. A measure is for
  sustained reading; the chrome's 12px voice is hints and captions, and those
  fill their container.
- **Wrapping prose gets `leading-normal`; dense chrome does not.** `text-xs`
  ships at 1.333, which is right for a table cell or a single-line label and
  too tight for a paragraph that wraps. Any `<p>` whose text runs past roughly
  one line takes `leading-normal`. This is the "tighten where people compare
  and act, breathe where they read" rule as a concrete instruction.
- **Every number sets in tabular figures.** Counts, ordinals, dates, scores, per-week frequencies, percentages, durations - anything that can sit in a column or change in place gets `tabular-nums`, and numeric table columns are `text-right`. Without it a column of figures jitters as digits change width. The one exception is running prose: the uniform advance that makes a column scan makes a sentence read worse.
- **Elevation is tinted with the ink.** `--shadow-sm` / `--shadow-md` / `--shadow-xl` are overridden in `@theme inline` to carry `--foreground` via `color-mix` rather than Tailwind's black. Black over warm cream reads grey and dirty. Only those three steps are overridden - they are the three this app renders. Reach for a hairline before a shadow; flat is the default.

Fonts are IBM Plex Sans (`--font-sans`, also aliased `--font-heading`) and IBM Plex Mono (`--font-mono`), loaded via `next/font/google` in `app/layout.tsx`. The pair was chosen together rather than separately: both halves carry real tabular figures, which matters because `tabular-nums` appears on nearly every number in the product. **Weights are 400/500/600 and that set is closed** - Plex is a static family on Google Fonts, so anything not loaded is synthesised by the browser into a faux weight. Add the weight in `layout.tsx` before reaching for `font-bold` in a component.

**The binding spec is `docs/design-system.md` in the sibling `gradient` repo.** It covers both apps and is the authority on the flat-panel rule, the shadow/overlay split, colour rationing, selection, density, forms and content. Read it before changing anything visual. What follows is either enforced here in code or is a fact about *this* app that a shared doc can't hold.

**Enforced, not documented.** `tests/contrast.test.ts` reads the tokens straight out of `app/globals.css`, so it cannot drift from the palette it checks. It asserts both directions: every pairing the rules allow clears 4.5:1 (3:1 non-text), *and* every pairing they forbid stays below 4.5:1 - so a palette change that quietly makes a banned combination safe fails as a stale rule rather than passing unnoticed. It also fails on any raw hex or `rgba()` outside the token block. Run `npm run test` after touching a token.

**Two tokens exist because the obvious choice fails contrast.** `--destructive-ink` (`#b5194c`) is for text on a `--destructive` tint - the brand pink is 4.05:1 on its own `/10` and 3.45:1 on the `/20` hover, both under AA. `--destructive` itself is unchanged and still owns dots, spines, solid marks and chart-4. And `--ring` is a decorative halo at 2.72:1, never a boundary, which is what the focus recipe below is about.

**Focus ring - one boundary on `--primary`, one halo in `--ring`.** Three shapes, picked by what the control is:

```
focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50                                  # has a border to recolour
focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:inset-ring-2 focus-visible:inset-ring-primary    # borderless, but a padded box
focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary   # padding-less text-only target
```

Three traps, each of which produces an indicator that looks right in review and is invisible or wrong in the browser:

- **Don't reach for `outline-*` on a padded control.** Nearly every primitive carries `outline-none`, which sets `--tw-outline-style: none`; a `focus-visible:outline-2` added on top compiles to `outline-style: none`. That is why the third recipe also carries `outline-solid`, and why the second prefers `inset-ring`.
- **Don't put `inset-ring` on a padding-less text link.** A 2px inset ring on a tight text box lands on the glyphs.
- **Don't hand-write the ring as a `box-shadow`.** `box-shadow` assigns rather than appends, so a hand-rolled ring silently drops the `shadow-md`/`shadow-xl` of any elevated surface while focused. Tailwind's `ring-*`, `inset-ring-*` and `shadow-*` compose through separate variables and are safe together (`dialog.tsx` carries `ring-1` and `shadow-xl` at once).

Keep the whole indicator inside ~4px of the border box - any ancestor with `overflow` clips what a child paints outside it - so don't add `ring-offset` on top of `ring-3`. `inset-ring` is immune, being inside the box.

**Eyebrows are a component, not a class string.** `<Eyebrow>` from `components/ui/eyebrow.tsx` is the 11px uppercase label - weight 500, `tracking-eyebrow`, muted, with `as` for the tag and `mono` for IDs and timestamps. The treatment had drifted into nine variants (three weights crossed with three trackings, one of them an arbitrary `tracking-[0.06em]`) before it was pulled into one place. The tracking is *positive* while headings track negative: an eyebrow is taxonomy, not a small headline. There is a second, larger eyebrow tier at `text-xs` with `tracking-wide` - 12px needs less opening up than 11px - which stays a class string because it is on 51 sites and already consistent.

**Form fields use `<Field>`** from `components/ui/field.tsx`: label, control, and one line of help *or* error under it. It exists for `aria-describedby` - the stacking was already consistent by hand, but the description was never wired, so help text was invisible to a screen reader. Pair it with `fieldDescriptionId(id)` on the control. Error replaces help rather than stacking under it, carries `role="alert"`, and is real text - a red border alone says nothing to a colourblind reader and nothing at all to a screen reader.

**Type is Tailwind's scale plus one named step.** `--text-3xs` (11px) is for uppercase eyebrows, chips and dense meta. `text-xs` is the body voice of the chrome, `text-sm` is controls, `text-2xl` is the page headline. **An arbitrary font size (`text-[10px]`) is drift, not a decision** - add a named step instead. Two traps: `text-base` on `input`/`textarea` is 16px deliberately, because iOS Safari zooms the viewport on focus below that, so they read `text-base ... md:text-sm` and `--text-base` must not shrink; and `--text-3xs` intentionally has no paired `--text-3xs--line-height`, so it emits `font-size` only and inherits line-height like the arbitrary values it replaced.

**Motion budget: entry animations on `dialog.tsx`, `select.tsx`, `command-palette.tsx` and the `segmented-control.tsx` indicator, and nothing else.** Each honours `prefers-reduced-motion` via `motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none` - the compound form, so the guard doesn't depend on `data-open` keeping the zero-specificity `:where()` that tw-animate-css currently gives it. **Any new overlay needs the same.** Drag transitions in `roadmap/board.tsx` and `learn/sortable-video-grid.tsx` are dnd-kit inline styles that CSS variants can't reach; they're user-initiated, so they're out of budget by intent, not oversight.

**Responsive: `md` (48rem) is the single navigation breakpoint.**

| Breakpoint | What changes |
| --- | --- |
| `< md` | `_components/mobile-top-bar.tsx` **is** the navigation. The sidebar is `hidden md:flex` and absent. `redirect-toast` drops to `top-16` to clear the bar. |
| `>= md` | Sidebar appears as a sticky full-height rail, collapsible and cookie-persisted (`lib/sidebar.ts`); the mobile bar is `md:hidden`. Inputs step down to `text-sm`. |
| `sm` (40rem) | The dominant *content* breakpoint: grid columns, page padding, table density. No navigation effect. |

Delete `mobile-top-bar.tsx` and the entire sub-`md` navigation layer goes with it, with no error.

**Z-index has five layers, named after what lives there.** Don't renumber to tidy them - that's risk for no gain.

| Layer | Used by |
| --- | --- |
| `z-10` in-flow | sticky table headers and pinned first columns, sticky panel headers, the drag-lifted card, badges over a thumbnail |
| `z-20` anchored popover | `tag-input`, `people-picker`, `champions-manager` suggestion lists; the drag handle over a card |
| `z-30` page chrome | `detail-header.tsx` sticky header |
| `z-40` app banner | `impersonation-banner.tsx` - must sit above page chrome and never be covered |
| `z-50` overlay | `dialog`, `select` popup, `command-palette`, `view-as-switcher` menu, `redirect-toast` |

Two known inconsistencies, left alone deliberately: `view-as-switcher`'s anchored menu is `z-50` where the structurally identical pickers are `z-20`, and `redirect-toast` shares `z-50` with `dialog`, so a dialog can cover a toast.

**Known open, so nobody re-derives them.** Two rules live in the shared spec but have no consumer here yet: the scroll boundary (a scrollable panel gets a sticky header with `border-b`; a sticky table header gets `inset 0 -1px 0 var(--border)`, a hairline and not elevation) and colour-as-data (a matrix/diff/heatmap **may** wash a surface, from the categorical ramp only, mixed toward `transparent` and never toward `--background`, with the text staying ink or a link). A full eight-step type scale with proper heading roles is deferred - the `xl`/`2xl` roles need a real decision, not a token rename.

The **text ladder is three rungs**: `--foreground` (headings, cell values), `--body-foreground` (#313461 - running prose on a reading surface, 11.23:1 on cream) and `--muted-foreground` (meta, captions, labels, help text). The reading rung was added because a paragraph had to borrow either the heading ink, too loud to read at length, or the meta grey, too faint to be the point of the page. Its consumers are the paragraphs the code already marks `max-w-prose`; all four of its pairings are asserted in `tests/contrast.test.ts`. A fourth, fainter rung for placeholders and disabled text is **not** possible in this palette - anything lighter than `--muted-foreground` drops below 4.5:1 on cream.
