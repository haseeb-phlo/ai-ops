@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The `@AGENTS.md` import above is load-bearing: this project pins **Next.js 16.2.4 + React 19.2**, which has breaking changes from earlier Next.js. Before writing Next.js / React code, consult `node_modules/next/dist/docs/` rather than relying on training data.

## Commands

```bash
npm run dev      # next dev - local dev server on :3000
npm run build    # next build
npm run start    # next start (serves the production build)
npm run lint     # eslint (flat config in eslint.config.mjs)
npm run test     # vitest
```

Vitest runs in `jsdom` with globals enabled; tests live in `tests/**/*.test.ts(x)`. The `@/*` alias is mirrored in `vitest.config.ts`. Run a single file with `npm run test -- tests/metrics.test.ts`, or a single case with `-t "name"`.

## Environment

Env vars (see `../.example_env` - the example file lives one directory **above** the repo root, shared with sibling Phlo projects):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` - required only for system-initiated paths (cron, scripts). `createAdminClient()` throws at first use if missing; the rest of the app boots without it.
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY` - optional in dev; when unset, `lib/resend.ts` exports `null` and sends no-op.
- `EMAIL_FROM` - optional; defaults to the Resend test domain.
- `CRON_SECRET` - required in production for `/api/cron/*`. Vercel injects this on Cron-triggered requests; the route checks it with a constant-time compare.

Path alias: `@/*` → repository root (e.g. `@/lib/supabase/server`).

## Architecture

### Auth-gated proxy (not middleware)

This Next.js version replaces `middleware.ts` with **`proxy.ts`** at the repo root. `proxy.ts` exports `proxy(request)` and a `config.matcher` and runs on every non-asset route. It delegates to `lib/supabase/proxy.ts:updateSession`, which:

1. Constructs a `createServerClient` wired to read/write request+response cookies.
2. Calls `supabase.auth.getUser()` - this both validates and refreshes the session token. **Do not insert code between `createServerClient` and `getUser`** (comment in the file flags this - it can break session refresh).
3. Redirects to `/login` for unauthenticated requests, except paths under `/login` and `/auth`.

Treat `proxy.ts` as the single global gate. Pages do not need to re-check auth for "is the user logged in" - by the time a request reaches a page, it is.

### Email-domain allowlist

`lib/auth-domain.ts` pins auth to a single domain (`@wearephlo.com`) via `isAllowedEmail`. It's enforced in three layers - the proxy, the `/auth/callback` route, and `getSessionUser` - and the file is intentionally dependency-free so it can be imported from any execution context (Edge proxy, RSC, Server Action, client). When changing the allowed domain, update this one constant.

### Supabase clients, one per execution context

`lib/supabase/` has four factories - pick the one matching where you're calling from:

- `client.ts` → `createBrowserClient` for Client Components (`"use client"`).
- `server.ts` → `createServerClient` reading `cookies()` from `next/headers`. Use in Server Components, Server Actions, and Route Handlers responding to a human request. The `setAll` swallows errors because Server Components can't set cookies; the proxy handles refresh, so this is safe.
- `proxy.ts` → request/response-bound variant used only by the root `proxy.ts`.
- `admin.ts` → `createAdminClient()` returns a **service-role** client that bypasses RLS. Use **only** in system-initiated contexts (Cron handlers, scripts, internal RPCs). Never on a request path where the caller is a human - those must use `server.ts` so RLS is enforced against the user's JWT. The factory throws at first call when `SUPABASE_SERVICE_ROLE_KEY` is missing rather than at import, so dev/test environments without the key still boot.

### Session + role loading

`lib/auth.ts:getSessionUser` is the canonical "who is the current user" function for server-rendered code. It:

- Calls `supabase.auth.getUser()` and redirects to `/login` if absent (defense in depth on top of the proxy).
- In parallel, loads `role_grants` (role/team), `profiles` (display_name/avatar/title), and the `people` directory row matched by email - display name resolution prefers profile → people → email-local-part via `resolveDisplayName`.
- Applies the view-as cookie (see below) to produce *effective* `role`/`team` while keeping the underlying `realRole`/`realTeam` and an `isImpersonating` flag.
- Is wrapped in React's `cache()` so layout + page + header in one render share a single DB hit.

### View-as impersonation

Super admins can preview the app as another role without leaving their session. `lib/view-as.ts` exposes `setViewAs(role, team)` / `clearViewAs()` Server Actions that read/write the `view_as` cookie (`VIEW_AS_COOKIE` in `lib/auth.ts`), gated on `realRole === "super_admin"`. `getSessionUser` reads the cookie and, *only* when the underlying grant is super_admin, overrides `role`/`team` and sets `isImpersonating: true`.

Two critical implications:
- **DB-layer privileges don't change.** `auth.uid()` is still the super_admin, so RLS allows writes the impersonated role couldn't perform. This is why `requireWriter()` (in `lib/auth.ts`) blocks every mutating action while `isImpersonating` is true.
- **UI reads use `role`; mutation guards use `realRole`.** Reverse them and you either leak admin chrome to impersonated views or silently allow forbidden writes.

### Route layout

- `app/(protected)/` - route group whose `layout.tsx` calls `getSessionUser()` and renders the app chrome: `Sidebar` (collapsible, cookie-persisted via `SIDEBAR_COLLAPSED_COOKIE` in `lib/sidebar.ts`), `MobileTopBar`, `ImpersonationBanner`, and the global `CommandPalette`. New authenticated pages go inside this group.
- Feature areas under `app/(protected)/` follow a consistent shape: `page.tsx` (list/index), `[id]/` (detail), `_components/` (route-local UI), `actions.ts` (Server Actions). Mutations go through `actions.ts` next to the route, not separate API routes. Server Actions validate inputs with Zod at the boundary; trust the parsed shape downstream.
- The `_components/` underscore prefix marks a Next.js **private folder** - excluded from routing. Use it for any route-local file that isn't a page/layout/route handler.
- `app/login/page.tsx` - Client Component using Supabase magic-link OTP (`signInWithOtp`), redirect target `${origin}/auth/callback`.
- `app/auth/callback/route.ts` - exchanges the OTP `code` for a session via `exchangeCodeForSession`, then redirects to `?next=` or `/`.
- `app/auth/signout/route.ts` - POST handler used by the sidebar's sign-out form.
- `app/api/` - reserved for system endpoints (Cron handlers, the `/api/search/index` global search endpoint). Application mutations still belong in route-local `actions.ts`, not here.

### Mutation conventions

Server Actions that mutate state follow four conventions consistently. Breaking them produces silent bugs (wrong user attribution, stale dashboards, missing audit rows).

1. **`requireWriter()` at the top.** Every mutating Server Action starts with `const gate = await requireWriter(); if (!gate.ok) return { kind: "error", message: gate.error };`. This rejects writes while a super_admin is impersonating another role via the view-as cookie - without it, "test as a member" silently writes through at the DB layer because `auth.uid()` is unchanged.

2. **`role` vs `realRole` on `SessionUser`.** `getSessionUser()` returns *effective* `role`/`team` (what the user is currently viewing as) and *actual* `realRole`/`realTeam` (their underlying grant). UI gating uses `role`; mutation guards must use `realRole` - `requireWriter()` does this for you.

3. **`revalidatePath` for every reader.** After a write, call `revalidatePath` on every route that displays the touched data - including the dashboard (`/`) if the change should show up in "Recent activity". Forgetting this is the most common "data didn't update" bug (workflow create needs `/workflows`, `/map`, and `/`).

4. **Audit rows before the table update.** Workflow/step mutations insert into `workflow_revisions` / `step_revisions` *before* updating the underlying row, so the admin audit log at `/admin` never shows a write that has no revision. One revision row per changed field; skip writes when nothing diffed.

Per-resource edit permission helpers (e.g. `canUserEditWorkflow` in `app/(protected)/workflows/[id]/actions.ts`) are exported so the page can compute `canEdit` once and the action can re-verify on submit.

### Soft delete

Workflows use `deleted_at` + `deleted_by` columns; reads filter `.is("deleted_at", null)`. The `/admin` page lists deleted rows and offers restore. Don't `DELETE FROM` - soft delete preserves the audit trail and lets champions/admins undo mistakes.

### Cron & system-initiated endpoints

Scheduled jobs are declared in `vercel.json` under `crons` (currently a Wednesday-morning digest at `0 7 * * 3` hitting `/api/cron/digest`) and run as ordinary `app/api/cron/*/route.ts` handlers. Three pieces interlock:

1. **Proxy bypass.** `lib/supabase/proxy.ts` skips the cookie-based auth gate for paths starting with `/api/cron`, because Vercel Cron requests carry no Supabase session - without the skip they'd be redirected to `/login` before the handler ran.
2. **Bearer-token gate.** Every cron handler must call `isCronAuthorized` from `lib/cron-auth.ts` before doing any work. In production it requires `Authorization: Bearer ${CRON_SECRET}` (constant-time compare via `timingSafeEqual`); in non-production it additionally requires a localhost `Host` header so a stray `NODE_ENV=development` deploy can't expose the endpoint publicly.
3. **Service-role DB access.** Cron handlers have no user JWT, so they use `createAdminClient()` from `lib/supabase/admin.ts` and are responsible for any access checks that RLS would have enforced.

When adding a new scheduled job, add the entry to `vercel.json`, gate the handler with `isCronAuthorized`, and use `createAdminClient()` for DB writes. The `/api/cron/digest` route is the canonical example.

### Database schema

The project uses the Supabase CLI for migrations as of 2026-05-26. Layout:

- `supabase/migrations/` - the active migration pipeline. Files are timestamp-prefixed and applied in order. The first file (`20260526090413_baseline.sql`) is a `pg_dump` snapshot of prod at adoption time and is marked as already-applied via `supabase migration repair`; it never runs again.
- `supabase/legacy/` - historical record of the ad-hoc `.sql` files that built the schema before CLI adoption. Reference-only; do not add to it. Each file has a comment block explaining the *why* of a particular policy or column, which is useful when debugging.
- `supabase/seed.sql`, `supabase/people_seed.sql`, `supabase/clear_seed_*.sql` - reference seeds, run manually as needed.
- `supabase/config.toml` - Supabase CLI config (project_id, ports, etc.).
- `lib/database.types.ts` - generated TypeScript types for every table / view / RPC. Re-run after every migration so types stay in sync.

**Workflow for schema changes:**

```
npm run db:new <name>      # creates supabase/migrations/<timestamp>_<name>.sql
# edit the file
supabase db push           # applies pending migrations to the linked project
npm run db:types           # regenerates lib/database.types.ts
```

`npm run db:diff` shows drift between local migrations and the linked DB - useful when you've made changes in Studio that aren't yet captured in a migration file. The linked project is set via `supabase link --project-ref <ref>`; credentials are local-only in `supabase/.temp/`.

**`auth.users` triggers** (`on_auth_user_created`, `enforce_phlo_email_trigger`) live on a schema the `--schema public` dump skips, so they're appended manually at the bottom of the baseline. Any future change to these triggers must be written as an explicit migration that touches the `auth.users` table directly.

### Anthropic / Claude

`lib/anthropic.ts` is `server-only` and exports the configured client plus `CLAUDE_MODEL`. Import the constant rather than hardcoding model strings so the model can be bumped in one place.

### Transactional email (Resend)

`lib/resend.ts` is `server-only` and exports `resend` - a `Resend` client *or* `null` when `RESEND_API_KEY` is unset (dev environments boot without it). Callers must null-check before sending; do not throw on missing key. Templates live in `lib/emails/` as plain TS functions returning subject/html/text. `EMAIL_FROM` controls the From address; defaults to the Resend test domain so unconfigured dev environments don't crash.

### Styling and UI primitives

Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`). No `tailwind.config` - v4 is config-less by default; customize via `app/globals.css`.

shadcn/ui is configured (`components.json`, style `base-nova`, RSC enabled, lucide icons). Primitives live in `components/ui/` (button, dialog, input, select, table, etc.) with the `cn` helper at `@/lib/utils`. Reuse and extend these rather than introducing a parallel component library.
