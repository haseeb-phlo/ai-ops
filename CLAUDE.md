@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The `@AGENTS.md` import above is load-bearing: this project pins **Next.js 16.2.10 + React 19.2.4**, which has breaking changes from earlier Next.js. Before writing Next.js / React code, consult `node_modules/next/dist/docs/` rather than relying on training data.

File-scoped detail lives in `.claude/rules/` and loads automatically when you open matching files - `supabase-db.md`, `ui-styling.md`, `cron-jobs.md`, `lib-modules.md`. Everything below applies everywhere.

## Commands

```bash
npm run dev      # next dev - local dev server on :3000
npm run build    # next build
npm run lint     # eslint (flat config in eslint.config.mjs)
npm run test     # vitest
```

Run one test file with `npm run test -- tests/metrics.test.ts`, one case with `-t "name"`. Vitest is `jsdom` + globals; the `@/*` alias is mirrored in `vitest.config.ts`. The suite covers pure logic only - a consequence of the `"use server"` split described below, not an oversight.

Schema changes: `npm run db:new <name>` → edit the migration → `supabase db push` (**applies to the linked remote project**, not a local DB) → `npm run db:types`. Full pipeline notes in `.claude/rules/supabase-db.md`.

Log in locally without an email round-trip: `/auth/dev-login?email=you@wearephlo.com`. Dev-only and triple-gated - it 404s unless `NODE_ENV === "development"` *and* the Host is localhost, and it needs `SUPABASE_SERVICE_ROLE_KEY`.

## Environment

Env vars are documented in `../.example_env` - **one directory above the repo root**, shared with sibling Phlo projects. The non-obvious behaviours:

- `SUPABASE_SERVICE_ROLE_KEY` - needed only for system paths (cron, scripts, view-as-user). `createAdminClient()` throws at first *use*, not at import, so the app boots without it.
- `RESEND_API_KEY` - unset in dev is fine: `lib/resend.ts` exports `null` and callers null-check rather than throw.
- `CRON_SECRET` - required in production; Vercel injects it on Cron-triggered requests.

Path alias: `@/*` → repository root (e.g. `@/lib/supabase/server`).

**New Superset worktrees bootstrap themselves** via `.superset/config.json` (committed). Its `setup` array runs in a terminal in the new worktree on creation, `&&`-joined so a failure short-circuits: it copies `.env.local` from `$SUPERSET_ROOT_PATH` (the main checkout at `~/.superset/projects/ai-ops`, where the canonical gitignored env file lives) and then runs `npm ci`. `run` is `npm run dev`, launched by the Run button in its own pane. Superset reads this config from the **main checkout only** - a copy edited inside a worktree has no effect until it's merged to `main`; to test a change first, use the per-machine override at `~/.superset/projects/<projectId>/config.json`. Without this, a fresh worktree has no env file and every page 500s with "Your project's URL and Key are required to create a Supabase client".

## Auth is gated once, in `proxy.ts`

This Next.js version replaces `middleware.ts` with **`proxy.ts`** at the repo root, which delegates to `lib/supabase/proxy.ts:updateSession` and runs on every non-asset route. So **pages never re-check "is the user logged in"** - by the time a request reaches one, it is.

- `lib/auth-domain.ts:isAllowedEmail` pins auth to `@wearephlo.com`, enforced in three layers (proxy, `/auth/callback`, `getSessionUser`). Change the domain in that one constant.
- `/api/cron/*` is deliberately exempt from the gate, because Cron requests carry no session.

## Session, roles, and view-as

`lib/auth.ts:getSessionUser` is the canonical "who is the current user" for server code. It's wrapped in `cache()` so layout + page + header share one DB hit, and it returns *effective* `role`/`team` alongside *real* `realRole`/`realTeam`.

Super admins can view the app as someone else via the `view_as` cookie (`lib/view-as.ts`), in **two modes**:

- `setViewAs(role, team)` → `mode: "role"`. Overrides `role`/`team` only; identity stays the real super_admin's.
- `setViewAsUser(userId)` → `mode: "user"`. **`getSessionUser` replaces `id` and `email` with the target's**, so every identity-scoped read ("your comments", `created_by` checks, `canUserEditWorkflow`) resolves as that user.

Three implications, all easy to get backwards:

- **DB privileges never change.** `auth.uid()` is still the super_admin, so RLS would happily allow writes the impersonated user couldn't make. This is why `requireWriter()` blocks every mutation while `isImpersonating`.
- **UI reads use `role`; mutation guards use `realRole`.** Reversed, you either leak admin chrome into impersonated views or allow forbidden writes.
- **`user.id` is not "the logged-in human" in user mode.** Never attribute or audit a write to it.

## Mutation conventions

Mutations are Server Actions in `actions.ts` beside the route, never separate API routes, and they validate input with Zod at the boundary (trust the parsed shape downstream). All four conventions matter - breaking them produces silent bugs: wrong attribution, stale dashboards, missing audit rows.

1. **`requireWriter()` at the top of every mutating action.** `const gate = await requireWriter(); if (!gate.ok) return { kind: "error", message: gate.error };` Without it, "view as a member" silently writes through, because `auth.uid()` is unchanged.
2. **UI gating uses `role`; mutation guards use `realRole`** - `requireWriter()` does this for you.
3. **`revalidatePath` every reader**, including the dashboard `/` when the change should appear in "Recent activity". This is the most common "data didn't update" bug: a workflow create needs `/workflows`, `/map`, and `/`.
4. **Audit rows before the table update.** Insert `workflow_revisions` / `step_revisions` *before* updating the row, one per changed field, so `/admin`'s audit log never shows a write with no revision. Skip writes when nothing diffed.

### Put testable logic beside `actions.ts`, not inside it

A `"use server"` file may only export async functions, so pure rules live in sibling modules that `actions.ts` imports - which is also what makes them unit-testable:

- `workflows/[id]/permissions.ts` - `canUserEditWorkflow`, exported so the page computes `canEdit` once and the action re-verifies on submit. It reads *effective* role/team on purpose, which is safe only because `requireWriter()` runs first.
- `roadmap/reorder.ts` - `renumberQueue`. Queue ranks are queue-scoped, so a reorder renumbers the lane 1..n.
- `learn/reorder.ts` - `redealBucketPositions`. Learn positions are **global and interleaved across topic buckets**, so a reorder re-deals the bucket's existing slot values instead of renumbering, and can't disturb rows it didn't touch.

Follow the same split for new logic worth testing.

### Two invariants that fail silently

- **Cadence dual-write.** Rows store `frequency_cadence` (what the user picked) *and* a numeric `frequency_per_week` / `uses_per_week` (what dashboard math multiplies by). Every write must set the numeric column from the cadence via `CADENCE_PER_WEEK` in `lib/frequency.ts`, or the impact tiles quietly disagree with the UI.
- **One queue, two tables.** The roadmap queue spans `intervention_suggestions` (`status='queued'`) *and* `ai_interventions` (paused, unshipped, ranked). Sort every queue surface with `compareQueueOrder` from `lib/roadmap.ts` so ordinals agree between the board and the dashboard snapshot.

## Gotchas that reading the code won't warn you about

- **Soft delete.** Workflows use `deleted_at` + `deleted_by` and reads filter `.is("deleted_at", null)`. Never `DELETE FROM` - the audit trail matters, and `/admin` lists deleted rows and restores them.
- **Pick the Supabase client for your execution context.** `lib/supabase/admin.ts` is a **service-role** client that bypasses RLS. Use it only in system contexts (cron, scripts) or after independently confirming the caller's *real* privilege - as `setViewAsUser` and `lib/impersonable-users.ts` do, both checking `realRole === "super_admin"` first. Never to serve data on behalf of an unprivileged caller.
- **Route names don't imply table names.** `interventions` (nav label "Initiatives") → `ai_interventions`; `suggestions` → `intervention_suggestions`; `roadmap` is a board over both; `workflows` is the soft-deletable `workflows` table.
- **`_components/` is a Next.js private folder**, excluded from routing - use it for any route-local file that isn't a page/layout/route handler. `admin/_actions/` is the one place mutations are split across a folder rather than a single `actions.ts`.
- **Server Action bodies are capped at 30mb** in `next.config.ts` for Learn video uploads. The 1 MB default rejects the body in the parser *before* an in-action size guard can return a friendly error.
- `/` is the dashboard (`app/(protected)/page.tsx`). `dashboard/` and `people/` are redirect stubs, not feature areas.
