@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The `@AGENTS.md` import above is load-bearing: this project pins **Next.js 16.2.4 + React 19.2**, which has breaking changes from earlier Next.js. Before writing Next.js / React code, consult `node_modules/next/dist/docs/` rather than relying on training data.

## Commands

```bash
npm run dev      # next dev — local dev server on :3000
npm run build    # next build
npm run start    # next start (serves the production build)
npm run lint     # eslint (flat config in eslint.config.mjs)
npm run test     # vitest
```

Vitest runs in `jsdom` with globals enabled; tests live in `tests/**/*.test.ts(x)`. The `@/*` alias is mirrored in `vitest.config.ts`. Run a single file with `npm run test -- tests/metrics.test.ts`, or a single case with `-t "name"`.

## Environment

Env vars (see `../.example_env` — the example file lives one directory **above** the repo root, shared with sibling Phlo projects):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`

Path alias: `@/*` → repository root (e.g. `@/lib/supabase/server`).

## Architecture

### Auth-gated proxy (not middleware)

This Next.js version replaces `middleware.ts` with **`proxy.ts`** at the repo root. `proxy.ts` exports `proxy(request)` and a `config.matcher` and runs on every non-asset route. It delegates to `lib/supabase/proxy.ts:updateSession`, which:

1. Constructs a `createServerClient` wired to read/write request+response cookies.
2. Calls `supabase.auth.getUser()` — this both validates and refreshes the session token. **Do not insert code between `createServerClient` and `getUser`** (comment in the file flags this — it can break session refresh).
3. Redirects to `/login` for unauthenticated requests, except paths under `/login` and `/auth`.

Treat `proxy.ts` as the single global gate. Pages do not need to re-check auth for "is the user logged in" — by the time a request reaches a page, it is.

### Three Supabase clients, one per execution context

`lib/supabase/` has three factories — pick the one matching where you're calling from:

- `client.ts` → `createBrowserClient` for Client Components (`"use client"`).
- `server.ts` → `createServerClient` reading `cookies()` from `next/headers`. Use in Server Components, Server Actions, and Route Handlers. The `setAll` swallows errors because Server Components can't set cookies; the proxy handles refresh, so this is safe.
- `proxy.ts` → request/response-bound variant used only by the root `proxy.ts`.

### Session + role loading

`lib/auth.ts:getSessionUser` is the canonical "who is the current user" function for server-rendered code. It:

- Calls `supabase.auth.getUser()` and redirects to `/login` if absent (defense in depth on top of the proxy).
- Joins against the `role_grants` table (`role`, `team` columns, keyed by `user_id`) and returns a `SessionUser` with defaults `role: "member"`, `team: null`.
- Is wrapped in React's `cache()` so layout + page + header in one render share a single DB hit.

### Route layout

- `app/(protected)/` — route group whose `layout.tsx` calls `getSessionUser()` and renders `<Header user={user} />`. New authenticated pages go inside this group.
- Feature areas under `app/(protected)/` follow a consistent shape: `page.tsx` (list/index), `[id]/` (detail), `_components/` (route-local UI), `actions.ts` (Server Actions). Mutations go through `actions.ts` next to the route, not separate API routes. Server Actions validate inputs with Zod at the boundary; trust the parsed shape downstream.
- The `_components/` underscore prefix marks a Next.js **private folder** — excluded from routing. Use it for any route-local file that isn't a page/layout/route handler.
- `app/login/page.tsx` — Client Component using Supabase magic-link OTP (`signInWithOtp`), redirect target `${origin}/auth/callback`.
- `app/auth/callback/route.ts` — exchanges the OTP `code` for a session via `exchangeCodeForSession`, then redirects to `?next=` or `/`.
- `app/auth/signout/route.ts` — POST handler used by the header's sign-out form.

### Database schema

`supabase/` holds the SQL source of truth: `schema.sql`, `workflows.sql`, and `*_migration.sql` files. Schema changes go here — there is no separate ORM or migration tool. When adding a column or table, update the relevant `.sql` file and apply it to your Supabase project.

### Anthropic / Claude

`lib/anthropic.ts` is `server-only` and exports the configured client plus `CLAUDE_MODEL`. Import the constant rather than hardcoding model strings so the model can be bumped in one place.

### Styling and UI primitives

Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`). No `tailwind.config` — v4 is config-less by default; customize via `app/globals.css`.

shadcn/ui is configured (`components.json`, style `base-nova`, RSC enabled, lucide icons). Primitives live in `components/ui/` (button, dialog, input, select, table, etc.) with the `cn` helper at `@/lib/utils`. Reuse and extend these rather than introducing a parallel component library.
