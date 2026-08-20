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

Fonts are Work Sans (`--font-sans`, also aliased `--font-heading`) and JetBrains Mono (`--font-mono`), loaded via `next/font/google` in `app/layout.tsx`.
