-- =========================================================================
-- Phlo AI Ops - company directory (public.people)
-- Run in Supabase Studio - SQL Editor BEFORE people_seed.sql.
-- Safe to re-run.
--
-- This is HR-style data for everyone in the company. It is decoupled from
-- auth.users / profiles by design: most rows here will never sign in. When
-- someone signs in for the first time, handle_new_user looks them up by
-- email and seeds their profile + role_grants from this row.
-- =========================================================================

create table if not exists public.people (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text not null,
  title        text not null,
  team         text not null,
  start_date   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists people_email_lower_idx
  on public.people ((lower(email)));
create index if not exists people_team_idx on public.people (team);

alter table public.people enable row level security;

drop policy if exists "people read all"        on public.people;
drop policy if exists "super_admin write people" on public.people;

create policy "people read all"
  on public.people for select to authenticated using (true);

create policy "super_admin write people"
  on public.people for all to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

-- handle_new_user: on signup, seed profile + role_grants from the directory.
-- Falls back to email-derived name if the user isn't in the directory.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_title        text;
  v_team         text;
begin
  select p.display_name, p.title, p.team
    into v_display_name, v_title, v_team
    from public.people p
   where lower(p.email) = lower(new.email)
   limit 1;

  insert into public.role_grants (user_id, role, team)
  values (new.id, 'member', v_team)
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, display_name, title)
  values (
    new.id,
    coalesce(v_display_name, split_part(new.email, '@', 1)),
    v_title
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill profiles/role_grants for users who already signed in before the
-- directory existed. Only fills nulls or default-derived values; never
-- overwrites a value the user has explicitly set in their profile.
update public.profiles p
   set title        = d.title,
       display_name = case
         when p.display_name is null
              or p.display_name = split_part(u.email, '@', 1)
         then d.display_name
         else p.display_name
       end,
       updated_at   = now()
  from public.people d
       join auth.users u on lower(u.email) = lower(d.email)
 where p.user_id = u.id
   and (p.title is null
        or p.display_name is null
        or p.display_name = split_part(u.email, '@', 1));

update public.role_grants g
   set team = d.team
  from public.people d
       join auth.users u on lower(u.email) = lower(d.email)
 where g.user_id = u.id
   and g.team is null;

notify pgrst, 'reload schema';
