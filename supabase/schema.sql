-- =========================================================================
-- Phlo AI Ops - auth schema
-- Run this in Supabase Studio → SQL Editor (one block at a time is fine).
-- =========================================================================

-- 1. role_grants table -----------------------------------------------------
-- One row per user. Stores their role + which team they're on.
create table if not exists public.role_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'member'
          check (role in ('admin', 'editor', 'viewer', 'member')),
  team    text,
  created_at timestamptz not null default now()
);

alter table public.role_grants enable row level security;

-- A user can read their own grant (needed by lib/auth.ts).
drop policy if exists "users read own grant" on public.role_grants;
create policy "users read own grant"
  on public.role_grants
  for select
  using (auth.uid() = user_id);

-- 2. Auto-create a default role_grants row when a new user signs up --------
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Restrict sign-up to @wearephlo.com emails ---------------------------
-- Runs before insert into auth.users. Rejects any non-wearephlo.com email.
create or replace function public.enforce_phlo_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is null or new.email !~* '@wearephlo\.com$' then
    raise exception 'Sign-up restricted to @wearephlo.com email addresses'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_phlo_email_trigger on auth.users;
create trigger enforce_phlo_email_trigger
  before insert on auth.users
  for each row execute function public.enforce_phlo_email();
