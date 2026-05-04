-- =========================================================================
-- Phlo AI Ops — profiles + metrics history migration (additive)
-- Run in Supabase Studio → SQL Editor AFTER schema.sql, workflows.sql,
-- workflows_migration.sql, interventions_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. profiles --------------------------------------------------------------
-- One row per auth.users. Holds display_name + avatar_url for the map and
-- the header.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  title        text,
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read all"   on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

create policy "profiles read all"
  on public.profiles for select to authenticated using (true);

create policy "profiles insert own"
  on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "profiles update own"
  on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Auto-create profile + role_grants on new signup ----------------------
-- Replaces the version in schema.sql so new users also get a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_grants (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 3. Backfill profiles for users that signed up before this migration -----
insert into public.profiles (user_id, display_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (user_id) do nothing;

-- 4. workflow_metrics_history (long-format weekly snapshots) --------------
-- One row per (workflow, week, metric). The map's time scrubber reads this.
create table if not exists public.workflow_metrics_history (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows(id) on delete cascade,
  snapshot_date date not null,
  metric        text not null
                check (metric in ('time','cost','people','errors','revenue')),
  value         numeric not null,
  unique (workflow_id, snapshot_date, metric)
);

create index if not exists wmh_workflow_idx
  on public.workflow_metrics_history(workflow_id, snapshot_date);

alter table public.workflow_metrics_history enable row level security;

drop policy if exists "wmh read all"      on public.workflow_metrics_history;
drop policy if exists "wmh insert authed" on public.workflow_metrics_history;

create policy "wmh read all"
  on public.workflow_metrics_history for select to authenticated using (true);

create policy "wmh insert authed"
  on public.workflow_metrics_history for insert to authenticated with check (true);
