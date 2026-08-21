---
paths:
  - "supabase/**"
  - "lib/supabase/**"
  - "lib/database.types.ts"
---

# Supabase clients and schema changes

## One client factory per execution context

`lib/supabase/` has four factories - pick the one matching where you're calling from:

- `client.ts` → `createBrowserClient` for Client Components (`"use client"`).
- `server.ts` → `createServerClient` reading `cookies()` from `next/headers`. Use in Server Components, Server Actions, and Route Handlers answering a human request. Its `setAll` swallows errors because Server Components can't set cookies; the proxy handles refresh, so this is safe.
- `proxy.ts` → request/response-bound variant, used only by the root `proxy.ts`. **Do not insert code between `createServerClient` and `getUser()`** here - that call refreshes the session token.
- `admin.ts` → `createAdminClient()` returns a **service-role** client that bypasses RLS. Use it in system-initiated contexts (Cron handlers, scripts), or on a human request path *only* after independently confirming the caller's **real** privilege - `setViewAsUser` and `loadImpersonableUsers` both check `realRole === "super_admin"` before reaching for it, because they need `auth.users`, which no user JWT can read. Anything serving data on behalf of an ordinary caller must use `server.ts` so RLS is enforced against that user's JWT. It throws at first call rather than at import, so environments without `SUPABASE_SERVICE_ROLE_KEY` still boot.

Reads of soft-deletable tables filter `.is("deleted_at", null)`.

## Schema changes

Migrations run through the Supabase CLI (adopted 2026-05-26):

```bash
npm run db:new <name>      # creates supabase/migrations/<timestamp>_<name>.sql
# edit the file
supabase db push           # applies pending migrations to the LINKED project
npm run db:types           # regenerates lib/database.types.ts - always, after every migration
```

`supabase db push` writes to the linked remote project, not a local database. `npm run db:diff` shows drift between local migrations and the linked DB, which is how you capture changes made by hand in Studio.

- `supabase/migrations/` - the active pipeline, applied in timestamp order. The first file (`20260526090413_baseline.sql`) is a `pg_dump` of prod at adoption time, marked already-applied via `supabase migration repair`; it never runs again.
- `supabase/legacy/` - historical record of the ad-hoc SQL that built the schema before CLI adoption. **Reference-only; never add to it.** Each file explains the *why* of a policy or column, which helps when debugging RLS.
- `supabase/seed.sql`, `people_seed.sql`, `clear_seed_*.sql` - run manually as needed.
- `lib/database.types.ts` - generated; edit the migration, not this file.

**`auth.users` triggers** (`on_auth_user_created`, `enforce_phlo_email_trigger`) live on a schema that the `--schema public` dump skips, so they're appended by hand at the bottom of the baseline. Any change to them must be an explicit migration touching `auth.users` directly.
