-- =========================================================================
-- Phlo AI Ops - champions visibility migration (additive)
--
-- Promotes champions from a hidden RLS rule into a first-class editorial
-- surface:
--   * blurb + chewing_on text on the champion record (their voice)
--   * champion_notes table   - one yellow margin annotation per
--                              (target_type, target_id, team)
--   * intervention_cosigns   - per-team co-sign stamp on an intervention
--
-- All three tables read-by-any-signed-in-user, write restricted to:
--   - super_admin, OR
--   - the champion record matching `team` (champions.user_id = auth.uid()).
--
-- Run AFTER admin_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. champions: editorial fields ------------------------------------------
alter table public.champions
  add column if not exists blurb       text,
  add column if not exists chewing_on  text,
  add column if not exists updated_at  timestamptz not null default now();

-- A champion is allowed to update their own row's editorial fields, even
-- though super_admin still owns provisioning (insert/delete). This policy
-- is additive to the existing super_admin write policy.
drop policy if exists "champion update own editorial" on public.champions;
create policy "champion update own editorial"
  on public.champions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. champion_notes -------------------------------------------------------
-- One row per (target_type, target_id, team). The team owns the note;
-- whichever person is currently the champion of that team is the editor.
create table if not exists public.champion_notes (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('workflow','intervention')),
  target_id    uuid not null,
  team         text not null,
  body         text not null,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (target_type, target_id, team)
);

create index if not exists champion_notes_target_idx
  on public.champion_notes (target_type, target_id);

create index if not exists champion_notes_team_idx
  on public.champion_notes (team);

alter table public.champion_notes enable row level security;

drop policy if exists "auth read champion_notes"     on public.champion_notes;
drop policy if exists "champion write champion_notes" on public.champion_notes;

create policy "auth read champion_notes"
  on public.champion_notes for select to authenticated using (true);

create policy "champion write champion_notes"
  on public.champion_notes for all to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.champions c
      where c.team = champion_notes.team and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.champions c
      where c.team = champion_notes.team and c.user_id = auth.uid()
    )
  );

-- 3. intervention_cosigns -------------------------------------------------
-- A team's champion can co-sign an intervention to vouch for it. Per-team,
-- so multiple teams can each independently stamp the same intervention.
create table if not exists public.intervention_cosigns (
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  team            text not null,
  signed_by       uuid references auth.users(id),
  signed_by_name  text,
  signed_at       timestamptz not null default now(),
  primary key (intervention_id, team)
);

create index if not exists intervention_cosigns_intervention_idx
  on public.intervention_cosigns (intervention_id);

alter table public.intervention_cosigns enable row level security;

drop policy if exists "auth read intervention_cosigns"      on public.intervention_cosigns;
drop policy if exists "champion write intervention_cosigns" on public.intervention_cosigns;

create policy "auth read intervention_cosigns"
  on public.intervention_cosigns for select to authenticated using (true);

create policy "champion write intervention_cosigns"
  on public.intervention_cosigns for all to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.champions c
      where c.team = intervention_cosigns.team and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.champions c
      where c.team = intervention_cosigns.team and c.user_id = auth.uid()
    )
  );
