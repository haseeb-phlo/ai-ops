# Phlo AI Ops — UX & Feature Deep Dive

A focused review of `app/(protected)` based on reading the home dashboard, header/nav, the four list pages (workflows, interventions, suggestions, learn), the people map, login, and the dashboard rails (trend-strip, top-wins, all-time-rail, activity-stream).

---

## Part A — UI / UX / Design

### Information architecture and navigation

- **`Nav.tsx:13`** — label says "People" but the href is `/map`. The URL says "map" and the title on `/map/page.tsx:101` also says "People". Pick one: rename the route to `/people` (and move `app/(protected)/people/page.tsx`, which is currently a 5-line stub, elsewhere or merge it).
- **No global Cmd-K command palette.** With six top-level surfaces and N detail pages per surface, a palette over workflows / initiatives / suggestions / videos / people would be the single biggest navigation upgrade. shadcn `<Command />` + Supabase RPC for fuzzy match.
- **No breadcrumbs on detail pages.** `interventions/[id]/page.tsx` uses `DetailHeader` with a "back" link but nothing tells a deep-linked user where they are. Breadcrumbs: `AI Initiatives › [name]`.
- **Mobile nav.** `_components/nav.tsx` is a horizontal list of 6–7 items; will overflow at narrow widths. Collapse into a `<Sheet />` hamburger on `<md`.
- **No sidebar collapse.** Header is horizontal-only — fine, but adds a top-bar tax on every page. Consider a left rail on desktop that frees vertical space (especially on workflows/interventions tables with many columns).
- **Admin tab is hidden from non-supers.** Good. But champions have meaningful triage powers (`suggestions/page.tsx:218-224`) with no dedicated landing. A `/champion` route showing "your team's suggestions, regulatory events, metrics to refresh" would give champions a reason to log in regularly.

### Visual system / tokens

- **Greyscale palette only.** `globals.css:70-74` defines five chart tokens but they're all neutral greys; the only color in the product is status (emerald/amber/red/blue/violet). Add one brand accent for primary CTAs, links, and the "Active" pill — it'll make the product feel less like a generic admin tool.
- **Dark mode is half-built.** `globals.css:86-118` ships full dark tokens but there's no toggle in the UI and no theme provider wired. Either ship the toggle (shadcn ThemeProvider) or delete the dark tokens.
- **Inconsistent border radius.** `--radius: 0.625rem` defined in globals.css, but pages mix `rounded-md`, `rounded-lg`, `rounded-xl` ad hoc. Pick one for surfaces (cards) and one for controls.
- **No motion/transitions.** Everything is static. A 150 ms fade-in on dialog open and a number tween on the dashboard stat tiles would lift the perceived polish meaningfully.
- **Custom inline SVG sparkline** (`trend-strip.tsx:84-153`) — fine for now, but it has no hover tooltips or value labels. Recharts (already a dependency) or vis-x with a tooltip would tell a much richer story.

### Dashboard (`app/(protected)/page.tsx`)

- **Stat tiles have no comparison.** Five raw numbers with no Δ vs last week. Most useful change: each tile shows `+£420 (+12%) vs last week`. You already compute the trend buckets — reuse week-0 vs week-1 totals.
- **Trend strip "vs 90d ago" is wrong.** `trend-strip.tsx:73` labels it "vs 90d ago" but you generate 13 weekly buckets covering ~84 days (`page.tsx:411-420`). Either say "vs 12 weeks ago" or extend the window.
- **Sparkline tooltips.** `Sparkline` (`trend-strip.tsx:84`) has no hover state — users can't read the value at a given week. Add a `<title>` per point or move to recharts.
- **Activity stream is too text-dense.** `activity-stream.tsx:230-272` uses single-letter glyphs (`W`, `S`, `C`) inside coloured circles. Replace with lucide icons (`Workflow`, `Lightbulb`, `MessageCircle`, `Video`), and group same-day events under a date heading instead of repeating dates per row.
- **Dashboard greeting is hollow.** `page.tsx:560-562` says "Hi {firstName} 👋" then jumps into company-wide numbers. Add a personal line: "You shipped 1 initiative this week · 3 suggestions need your vote · 2 videos in your queue".
- **No "next best action" prompt.** A new user lands and gets dense KPIs. Above the KPI row, surface 1–3 cards: "Log your first workflow", "Adopt an active initiative", "Watch the intro video".
- **All-time rail is text-only.** `all-time-rail.tsx` is a clean 3-tile row but no shape. A horizontal stacked bar (time / cost / revenue contribution) would visualize the mix at a glance.

### List pages

- **No search inputs.** Workflows, interventions, suggestions, learn — none have a text search box. Filters are dropdown-only (`workflows/_components/team-filter.tsx`, `interventions/_components/filters.tsx`). With dozens or hundreds of rows this gets old fast.
- **No column sorting on tables.** `workflows/page.tsx:225-234` and `interventions/page.tsx:196-205` have static column order. Click-to-sort by impact / frequency / steps would help champions triage.
- **No row density toggle.** Tables are spacious by default; power users want compact.
- **No quick row actions on hover.** Open / edit / link should appear on row hover instead of forcing a click-through to the detail page.
- **Empty states are text-only sentences** (e.g. `workflows/page.tsx:219`). Add a small illustration + "Log your first workflow" CTA — this is the moment a new user decides whether to stay.

### Forms and dialogs

- **`confirm()` for destructive actions.** `learn/_components/video-card.tsx:90` and `:300` use the native browser `confirm()`. Replace with shadcn `<AlertDialog />` — better keyboard nav, consistent style.
- **Single-step dialogs with many fields.** `NewWorkflowDialog` and `LogInterventionDialog` cram baseline metrics, owners, team, frequency, tools used, etc. into one form. Multi-step wizards (basic info → metrics → recipients → review) reduce abandonment and let you AI-suggest fields step by step.
- **No autosave / draft.** If a user closes a half-filled dialog, the data is gone.
- **No optimistic UI on votes / reactions.** `suggestions/_components/vote-button.tsx` posts back through a Server Action. Add `useOptimistic()` so the count moves instantly.

### Roadmap board (`suggestions/_components/roadmap.tsx`)

- Three columns (Up next / In progress / Shipped) — solid. But:
- **No swimlanes by team.** Hard to see which team owns what.
- **No WIP limits or shipped-this-quarter cutoff.** "Shipped" will grow unbounded.
- **No drag-handles or accessible keyboard alternative** (typical for HTML5 DnD).
- **No initiative ETA** on accepted/in-progress cards.

### Learn page

- **Six grouping layers (topic → subtopic → grid → comments → reactions → attachments) but no flat search.** A search bar at top + tag filter would help.
- **Backfill at render time** (`learn/page.tsx:114-126`) — first request to Loom oembed runs *during* the request. Move to a background job (Vercel Cron) or do it at upload time in `actions.ts`.
- **No play progress %.** A "watched" badge is binary; tracking watched % (Loom SDK) would make the "Your progress" pill meaningful.
- **No queue / save-for-later.** Personal video queue + "next up" autoplay would drive watch time.

### Accessibility / details

- **`alt=""` on avatar `img`** is fine for decorative use, but `<img>` is used instead of `<Image />` (suppressed with eslint comments at `header.tsx:33-37` and `:72-77`). Move to `next/image` so avatars get LCP optimization + lazy loading.
- **Galaxy map** (`map/_components/galaxy.tsx`) — gorgeous but probably keyboard-inaccessible. Make `directory` the default and `galaxy` a secondary view.
- **Toast / redirect feedback** (`redirect-toast.tsx`) exists, but no global error boundaries. Add `error.tsx` per route group.
- **No `loading.tsx`** in any of the protected feature dirs — every page-level data fetch blocks the route tree. Add skeleton loading files; the dashboard does ~10 parallel queries and that wait is visible.

### Microcopy

- The product has *two* names: "Phlo AI Ops" in the header lockup, "the workshop" in the repo. Pick one and use it consistently. The README and the login subtitle say different things.
- "AI Initiatives" vs "interventions" — DB calls them `ai_interventions`, UI calls them "AI Initiatives". OK to keep the UX-friendly label, but be consistent (the new-workflow dialog and metrics rail mix both).

---

## Part B — Features that would meaningfully boost engagement

Ranked roughly by impact/effort.

### 1. Periodic digest email (weekly or fortnightly)
Every Monday (or every other Monday): top wins from the period, suggestions needing your vote, your unwatched Learn videos, regulatory red/amber events on your team, your personal impact. `lib/resend.ts` and `lib/emails/` are ready; add a Vercel Cron job. **This alone will 5× the "I open the tool weekly" rate.**

### 2. Cmd-K command palette
Index workflows, interventions, suggestions, videos, people. shadcn `<Command />` (cmdk) + a tiny Supabase RPC. Three keystrokes instead of three clicks-and-a-scroll.

### 3. Personal impact + streak
"Your contribution this week: 240 min saved · 2 suggestions submitted · 1 video watched." A streak counter ("4 weeks in a row") drives weekly returns. Cheap to compute from existing tables.

### 4. AI assistant — "Ask the workshop"
You already have `ANTHROPIC_API_KEY` and `lib/anthropic.ts`. A side-panel chat that can answer:
- "Which automations save more than £100/wk?"
- "Suggest 3 AI interventions for [workflow]"
- "Summarise this week's regulatory events"

With tool-calling and a typed catalog of internal data, this becomes the front door of the product.

### 5. AI-drafted suggestions on a workflow
Open a workflow → "Generate AI suggestions" → Claude proposes 3 interventions with type/owner/estimated savings. User edits and submits. Removes the empty-suggestions cold-start.

### 6. Subscribe / watch
Per workflow, per intervention, per suggestion: subscribe to changes. Pair with the digest email for the notifications channel.

### 7. Adoption polling
Every 30 days, email the `recipient_emails` of each active intervention: "Still using X? Yes / No / Sometimes". Push the responses into `adoption_status`. Turns dormant data into a live signal — and gives Top Wins much sharper truth.

### 8. Workflow / initiative health scorecard
Each row gets a single 0-100 score derived from: data freshness, adoption, savings vs estimate, satisfaction. Sortable column = self-service triage for champions.

### 9. Comments on initiatives + @mentions
Suggestions already have a comment system (`intervention_suggestion_comments`). Mirror it on `ai_interventions`. Add `@name` mention tokenization + email/Slack ping.

### 10. Slack two-way integration
- `/phlo suggest <title>` → creates a suggestion.
- Daily Slack channel post with the activity stream digest.
- Suggestion status changes ping the submitter.

Existing email infra means you're already ⅔ there.

### 11. Goals / OKRs
Set "save 10,000 minutes / quarter". Show progress bar on the dashboard. Per-team and personal targets.

### 12. Onboarding tour
First-login interactive walkthrough — "Here's how to log a workflow … here's how to vote on a suggestion." Currently a new user sees a near-empty dashboard with no instructions.

### 13. Workflow templates
Pre-built workflow shapes per role (pharmacist morning routine, ops onboarding, sales follow-up). Lowers first-create friction from 12 fields to 2.

### 14. Saved views / pins
Pin a workflow or intervention to your dashboard. Save filters as named views ("My team's regulated workflows").

### 15. Public share links
Read-only deep links to a top-wins board or an initiative detail page — for sharing in leadership reviews without forcing those viewers through SSO.

### 16. PDF / Markdown export
"Export this quarter's wins as PDF" — one click, formatted for a board pack. A natural ROI moment.

### 17. Tool inventory
`ai_interventions.tools_used` exists but is never aggregated. A `/tools` page: every AI tool / vendor in use, count of initiatives per tool, total weekly impact attributable, who's using it. Useful both for procurement and for cross-team discovery.

### 18. Champions homepage
Champions exist (`champions` table) and are used for triage gating, but they don't have a place. A `/champion` route with "your team's suggestions inbox, regulatory events, metrics needing refresh" gives them a reason to log in every day.

### 19. Learn quizzes + certifications
3-question quiz after each video → badge on the People profile → leaderboard. Cheap to build, very high engagement upside for an internal learning hub.

### 20. Initiative regression alerts
When a snapshot moves backwards by >X%, post a regulatory-style event and email the owner. Catches "we shipped this in March, it's drifting now" silently.

### 21. Comparison view on intervention detail
Side-by-side "before / after" metric panel with the baseline and the latest snapshot, visualized. The data is all there in `workflow_baselines` and `intervention_metrics`.

### 22. Data-quality nudges on the dashboard
Inline cards: "3 initiatives haven't had a metric snapshot in 30 days — refresh now." Keeps the data useful and gives habitual users a daily task.

### 23. Calendar integration
Add an .ics feed for "regulatory check-ins" and "initiative review every 30 days". Pushes the workflow into people's existing calendar rhythm.

### 24. Recognition / kudos
"Send kudos" button on an intervention → posts in #wins Slack + records on the recipient's profile. Cheap, social, sticky.

---

## What I'd ship first

1. **Periodic digest email** + **Cmd-K palette** — both unlock retention immediately and cost <2 days each.
2. **Stat tiles w/ WoW delta** + **personal impact card** on dashboard — biggest "story" upgrade.
3. **AI assistant side panel** — your differentiator. Anthropic key is already wired.
4. **Adoption polling** + **subscribe/watch** — turns the data from stale to live without requiring users to remember to log.
5. **Search + sortable columns on every list** — table table-stakes.
