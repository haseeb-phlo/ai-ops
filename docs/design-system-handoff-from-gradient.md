# Handoff to AI Ops: what to change, and why

**For:** whoever picks this up in `projects/ai-ops`.
**Context:** the Knowledge Engine dashboard was moved onto AI Ops' reading of the
Phlo brand on 20 August 2026. Doing that port surfaced four defects in the AI Ops
system and seven gaps in its spec. This file is the return leg. Nothing here is a
matter of taste; every item is a measured failure, a missing rule, or a rule the
spec states but the code does not keep.

The shared rules now live in `docs/design-system.md` in the gradient repo. That
file binds both apps. This file is only the delta AI Ops needs to apply.

Work through it in order. Sections 1 to 4 are defects and should be fixed.
Sections 5 to 7 are documentation debt in the spec itself, which is what made the
port cost more than it should have.

---

## 1. The focus ring is not a legal focus indicator

**Severity: fix this one first. It is an accessibility defect on every control in
the app.**

`--ring: #00a9be` is **2.72:1** against the cream canvas and **2.83:1** against
white. WCAG 1.4.11 requires 3:1 for a focus indicator against adjacent colours.
The current recipe puts the entire indicator in that colour:

```
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

The border is the aqua (below 3:1) and the ring is the aqua at 50% (lower still).
There is no compliant edge anywhere in the indicator.

**The fix keeps the look.** Move the boundary to `--primary` (6.06:1 on cream,
6.32:1 on white) and keep the aqua as the halo it always was:

```diff
- focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
+ focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50
```

Counted in `components/ui`: `focus-visible:ring-3` and
`focus-visible:ring-ring/50` appear 15 times each, across `tabs.tsx`,
`nav-link.tsx`, `dismissable-alert.tsx`, `people-picker.tsx`,
`segmented-control.tsx`, `tag-input.tsx`, `badge.tsx`, `button.tsx`, `select.tsx`,
`input.tsx` and `textarea.tsx`. Of those, only six also swap the border
(`focus-visible:border-ring`: `badge`, `button`, `input`, `select`, `tabs`,
`textarea`).

**That split matters.** The six with a border swap need the one-word change above.
The five without one — `nav-link`, `segmented-control`, `tag-input`,
`people-picker`, `dismissable-alert` — currently have *no* compliant edge at all,
because the aqua halo is their entire indicator. They need a compliant boundary
added, not just recoloured. Something along these lines:

```diff
- focus-visible:ring-3 focus-visible:ring-ring/50
+ focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-primary
```

Treat that second line as a sketch rather than a drop-in: it was not run through
your build. `outline-primary` has to resolve as an outline-colour utility in your
`@theme inline` setup, and a couple of those five may not have a border box the
outline sits on cleanly. The measurement is solid, the exact utility pair is
yours to confirm.

Two things the dashboard learned implementing this, both of which will bite here
too:

- **Keep the whole indicator inside about 4px of the border box.** Any ancestor
  with `overflow` clips what a child paints outside it, so a focused row inside a
  scrolling panel loses the outer part of its ring. `ring-3` plus an offset is
  already close to that budget; do not add offset on top.
- **Do not hand-write the ring as a `box-shadow`.** `box-shadow` assigns rather
  than appends, so a hand-rolled ring on an element that also carries `shadow-md`
  or `shadow-xl` silently takes its elevation away while focused. Tailwind's own
  `ring-*` and `shadow-*` utilities compose through separate variables and are
  safe together — `dialog.tsx` already proves it, carrying `ring-1
  ring-foreground/10` and `shadow-xl` on the same element. So stay on the
  utilities. The dashboard had to solve this the hard way because it is plain CSS
  with no such composition, and it ended up storing each surface's shadow in an
  `--elevation` variable that the focus rule appends after the halo.

Verify by focusing a control and looking at it. This is not checkable by reading.

## 2. The destructive button fails AA

`--destructive` `#d81e5b` on its own 10% tint is **4.05:1** on cream and 4.23:1 on
white. The label is 14px medium, so it needs 4.5:1. The signature quiet-destructive
button is therefore below AA everywhere it appears.

**Fix:** add one token and use it for text on the tint only.

```diff
  --destructive: #d81e5b;
+ --destructive-ink: #c81a53;   /* 4.62:1 on the /10 tint over cream, 4.83:1 over white */
```

```diff
- destructive  bg-destructive/10 text-destructive hover:bg-destructive/20
+ destructive  bg-destructive/10 text-destructive-ink hover:bg-destructive/20
```

`--destructive` itself does not change: it stays the brand pink for dots, spines,
solid marks and chart-4. Only text sitting on its own tint moves. Add
`--color-destructive-ink: var(--destructive-ink);` to the `@theme inline` block or
the utility will not exist.

## 3. There is no type scale, only two heavily used Tailwind steps

Counted from `app` and `components` at the time of writing:

```
270  text-xs      10  text-[10px]
116  text-sm       9  text-[11px]
  9  text-2xl      1  text-[9px]      <- not mentioned anywhere in the spec
  5  text-base     1  text-[0.8rem]   <- inside a button size variant
  3  text-lg
  1  text-xl
```

Ten distinct sizes, four of them off-scale one-offs with 21 uses. "`text-xs` is
the body voice of the chrome" describes this accurately, but a description is not
a scale, and `text-[9px]` is drift that no rule sanctions.

The dashboard had the same disease in a worse form, seventeen distinct pixel
values, and cured it by anchoring eight tokens on the most-used value in each
cluster rather than on a ratio. That kept 100 of 146 declarations at their exact
existing value and moved the other 46 by 0.5 to 2px. See commit `14fcf3e`.

**Recommended fix:** define the eight steps as named utilities in `@theme inline`
and ban arbitrary values in review. The names matter more than the exact numbers,
because a named step is a decision and `text-[9px]` is an accident.

```css
@theme inline {
  --text-3xs: 0.6875rem;  /* 11px - uppercase eyebrows, chips, meta */
  --text-2xs: 0.78125rem; /* 12.5px - dense cells, secondary text */
  --text-xs: 0.8125rem;   /* 13px - table body, card body */
  --text-sm: 0.875rem;    /* 14px - controls, tabs, buttons */
  --text-base: 0.9375rem; /* 15px - body default */
  --text-md: 1.125rem;    /* 18px - panel and section headings */
  --text-lg: 1.375rem;    /* 22px - card titles, large stats */
  --text-xl: 1.5rem;      /* 24px - the one page headline */
}
```

Note this redefines `text-xs`, `text-sm` and `text-base` slightly. If that is too
invasive to do at once, the minimum useful step is to kill the four arbitrary
values and add `--text-3xs` for the `[10px]` / `[11px]` cluster, which is 20 of
the 21 off-scale uses.

## 4. Nothing honours `prefers-reduced-motion`

There are zero `prefers-reduced-motion` or `motion-reduce:` occurrences in `app`,
`components` or `lib`. Dialogs, the command palette, dropdowns, toasts and the
drag-lift all animate on entry, unrequested, over what the reader was looking at.
A sliding, scaling entrance is specifically what vestibular users ask not to be
given.

The motion budget is small, so the fix is small. Tailwind ships the variant:

```diff
- data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
+ data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 motion-reduce:animate-none
```

The dashboard does it per-surface rather than with a global wildcard, because the
list is short enough to name and naming it keeps the intent visible:

```css
@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal,
  .toast {
    animation: none;
  }
}
```

Either shape is fine. Keep the fade if you want the surface not to appear from
nowhere; it is the travel and the scale that need to go. The ordering principle
the dashboard's own comment records is worth repeating: a decorative shimmer is
something a reader can ignore, while a dialog and a toast arrive unrequested over
what they were reading, so those are the ones that must honour the setting first.

---

## 5. Rules the spec is missing, in the order they cost time

Each of these was reconstructed from your source during the port. Writing them
down is cheap now and expensive later.

### 5.1 The invariant the flat panel depends on

`--background` is the canvas **and** the in-page panel surface. The signature move
works only because those two are the same colour, so a panel is told apart from
the page by its hairline alone. Nothing in the code says so. Change `--background`
alone and the entire look dies silently, with no error and no failing test.

State it as a rule: **`--background` and the in-page panel surface change
together, or not at all.** Same class of problem for `--radius`: four derived
radii move together, and the role table hard-codes computed values (0.4rem,
0.7rem) that are only true at `0.5rem`.

### 5.2 Responsive behaviour, which the spec does not mention at all

The sidebar recipe is `hidden md:flex` and
`app/(protected)/_components/mobile-top-bar.tsx` replaces it below `md`. Anyone
porting from the spec loses the entire sub-`md` navigation layer and will not find
out from the document. Add a breakpoint table saying what collapses when.

### 5.3 A z-index scale

The source uses 26 z-utilities from `z-10` to `z-50`; the spec documents two.
Overlay stacking is the classic thing that breaks on arrival. Name the layers:
sticky, menu, modal, toast. Do not renumber to make them tidy, that is pure risk
for no gain.

### 5.4 The toast

It appears in the shadow table as a documented surface, but there is no toast in
`components/ui/`, no toast library in `package.json`, and the only implementation
is a bespoke `redirect-toast.tsx`. Either give it a recipe or take it out of the
table.

Derived from your own grammar, the recipe is: a toast is an alert that floats, so
ink-on-white with a 2px left spine in `--success` or `--destructive`, plus
`shadow-md`. Never a solid coloured slab. That is what the dashboard now ships.

### 5.5 Field-level form patterns

There is a `label.tsx` but no recipe for label / control / help / error stacking,
required markers, or error wiring via `aria-describedby`. `alert.tsx` covers
page-level messages, not field-level ones.

### 5.6 The scroll-boundary problem the flat rule creates

Banning in-page shadows removes the only cue that a scrolled pane has more content
below it. AI Ops has no two-pane scrolling layout so it has not hit this yet; the
dashboard is built from them. The answer is not a shadow: a scrollable panel gets
a sticky header with a `border-b`, and a sticky table header gets
`inset 0 -1px 0 var(--border)`. An inset hairline is not elevation. Worth adding
before the first split-pane view lands here.

### 5.7 Colour as data

This is the one genuinely new rule rather than a filled gap, and AI Ops will need
it the first time it renders a matrix, a diff or a heatmap. The rule that bans
status washes is right, and its rationale ("so a row of mixed statuses reads as
typography, not confetti") does not apply to a field of colour that is meant to be
read as a shape. So:

- A matrix, diff or chart **may** wash a surface, because there the colour is the
  data.
- Those fills come off the **categorical ramp**, never off the semantic tokens, so
  a drifted cell can never be mistaken for a destructive one.
- **The text in such a cell stays ink or a link, never the state's hue.** Tinting
  both is a trap: `--warning` on a `--chart-5` 18% fill is 3.84:1 and `--success`
  on a `--chart-2` 14% fill is 4.42:1. Both fail. `--primary` clears 4.98:1 and
  5.22:1 on the same fills.

```css
--data-positive: color-mix(in srgb, var(--chart-2) 14%, transparent);
--data-attention: color-mix(in srgb, var(--chart-5) 18%, transparent);
```

Mix toward `transparent`, never toward `--background`: a tint mixed toward cream
is wrong the moment it lands on a white dialog.

---

## 6. Two corrections to the spec's own text

- **"Actual usage in this codebase: `rounded-lg border border-border
  bg-background` appears 21×."** It is 40 occurrences across 26 files, and it was
  already 40 at the redesign merge `6079a32`, so the figure does not reconcile
  with any scoping. Counts embedded in prose rot; either regenerate them or drop
  them. They read as evidence and are currently decoration.
- **"Status/text colors hold >= 4.5:1 on the cream surface."** True on cream, and
  that is the claim as written, but it is read as a general guarantee and it is
  not one. `--warning` on `--muted` is 4.24:1, and the three data-fill and tint
  cases in sections 2 and 5.7 all fail. Add "on cream, and on white; every other
  pairing must be checked" or the sentence will keep being trusted where it does
  not hold.

## 7. Take the enforcement, not just the rules

Both specs predict their own erosion in prose ("don't 'fix' the input", "don't
correct destructive back to a solid red"). That is the tell that a linter's job is
being done by a paragraph.

`scripts/contrast.ts` in the gradient repo is about 260 lines with no
dependencies. It reads the tokens **out of the stylesheet** rather than restating
them, so it cannot drift from the palette it checks, and it asserts three things:

1. every pairing the rules **allow** meets 4.5:1, or 3:1 for non-text;
2. every pairing the rules **forbid** is still below 4.5:1, so a palette change
   that quietly makes one safe shows up as `STALE` rather than passing unnoticed;
3. no raw hex outside the token block, and no unexpected `rgba()`.

Point 2 is the part worth copying. It is what turns "never put warning text on a
muted fill" from a sentence someone will not read into a check that fails.

Porting it here means pointing `CSS` at `app/globals.css` and replacing the
`over()` alphas with the ones your utilities use (`/85`, `/10`, `/50`, `/60`). The
maths and the structure carry over unchanged.

---

## Checklist

- [ ] Focus boundary moved to `--primary` on all ten primitives, verified by
      focusing a control in a scrolling container
- [ ] `--destructive-ink` added, exposed in `@theme inline`, used by the
      destructive button variant
- [ ] Eight named type tokens defined; the four arbitrary sizes removed
- [ ] `prefers-reduced-motion` honoured by every animated surface
- [ ] Background/panel invariant and radius-derivation note written into the spec
- [ ] Breakpoint table written, including what `mobile-top-bar.tsx` does
- [ ] Z-index layers named
- [ ] Toast given a recipe, or removed from the shadow table
- [ ] Field-level form pattern documented
- [ ] Scroll-boundary rule documented
- [ ] Colour-as-data rule adopted, with ramp-sourced fills and ink text
- [ ] Stale counts regenerated or dropped; the contrast claim qualified
- [ ] A contrast check runs in CI and fails the build
