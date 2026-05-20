-- =========================================================================
-- Phlo AI Ops - per-period dedupe for the fortnightly digest cron
--
-- The cron handler claims a row in digest_sends keyed by ISO year + week
-- BEFORE sending. Vercel cron retries on 5xx and the "Run now" button is
-- one mis-click away from a second blast - without this table a retry
-- would re-email every recipient. The unique primary key makes the
-- second insert fail with conflict, and the cron exits early.
--
-- Only the service-role cron touches this table. RLS is enabled with no
-- policies so an authenticated client can't read or write it via REST.
--
-- ?force=1 on the cron URL bypasses the claim entirely - intentional, for
-- ops triage / manual recovery from a missed send. Run sparingly.
--
-- Safe to re-run.
-- =========================================================================

create table if not exists public.digest_sends (
  period_key      text primary key,
  sent_at         timestamptz not null default now(),
  recipient_count int,
  forced          boolean not null default false
);

alter table public.digest_sends enable row level security;

-- No CRUD for end users. service_role bypasses RLS anyway; the grants
-- here are what authorize the REST calls themselves (Supabase grants
-- service_role default privileges on new tables, but the project's
-- migration history has revoked-then-explicit pattern, so be explicit).
grant select, insert, update on public.digest_sends to service_role;

notify pgrst, 'reload schema';
