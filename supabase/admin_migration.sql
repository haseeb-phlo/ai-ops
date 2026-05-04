-- =========================================================================
-- Phlo AI Ops - admin migration (additive)
-- Adds the schema the /admin page reads from:
--   * 'super_admin' role
--   * regulatory traffic-light on workflow_steps
--   * regulatory_events table (incidents that need closing out)
--   * workflow_revisions table (header-level audit trail; we already
--     have step_revisions for inline edits)
--   * ai_interventions.vendor (for the cost-by-vendor breakdown)
--   * champions table (per-team owner with last check-in)
-- Run AFTER all earlier migrations. Safe to re-run.
-- =========================================================================

-- 1. super_admin role -----------------------------------------------------
alter table public.role_grants
  drop constraint if exists role_grants_role_check;
alter table public.role_grants
  add  constraint role_grants_role_check
       check (role in ('super_admin', 'admin', 'editor', 'viewer', 'member'));

-- 2. regulatory traffic light on workflow_steps ---------------------------
alter table public.workflow_steps
  add column if not exists regulatory_flag text;

alter table public.workflow_steps
  drop constraint if exists workflow_steps_regulatory_flag_check;
alter table public.workflow_steps
  add  constraint workflow_steps_regulatory_flag_check
       check (regulatory_flag is null
              or regulatory_flag in ('red','amber','green'));

create index if not exists workflow_steps_regulatory_flag_idx
  on public.workflow_steps(regulatory_flag)
  where regulatory_flag is not null;

-- 3. regulatory_events ----------------------------------------------------
create table if not exists public.regulatory_events (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid references public.workflows(id) on delete set null,
  step_id       uuid references public.workflow_steps(id) on delete set null,
  severity      text not null check (severity in ('red','amber','green')),
  summary       text not null,
  resolved_at   timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists regulatory_events_unresolved_idx
  on public.regulatory_events(created_at desc)
  where resolved_at is null;

create index if not exists regulatory_events_workflow_idx
  on public.regulatory_events(workflow_id);

alter table public.regulatory_events enable row level security;

-- 4. workflow_revisions ---------------------------------------------------
create table if not exists public.workflow_revisions (
  id               uuid primary key default gen_random_uuid(),
  workflow_id      uuid not null references public.workflows(id) on delete cascade,
  field            text not null,
  old_value        text,
  new_value        text,
  changed_by       uuid references auth.users(id),
  changed_by_email text,
  changed_at       timestamptz not null default now()
);

create index if not exists workflow_revisions_workflow_idx
  on public.workflow_revisions (workflow_id, changed_at desc);

alter table public.workflow_revisions enable row level security;

-- 5. ai_interventions.vendor ----------------------------------------------
alter table public.ai_interventions
  add column if not exists vendor text;

-- 6. champions ------------------------------------------------------------
create table if not exists public.champions (
  id              uuid primary key default gen_random_uuid(),
  team            text not null unique,
  user_id         uuid references auth.users(id) on delete set null,
  display_name    text not null,
  last_check_in   timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.champions enable row level security;

-- 7. RLS policies ---------------------------------------------------------
-- The proxy + page-level redirect already gate /admin at the route layer.
-- These policies are defence-in-depth: even if a viewer hits a Supabase
-- query directly with their own JWT, super_admin-only tables are unreadable.

-- regulatory_events: readable by any signed-in user (the register on /admin
-- shows a count, and other pages may surface alerts). Writes restricted to
-- super_admin so a viewer can't fabricate or close an incident.
drop policy if exists "auth read regulatory_events"        on public.regulatory_events;
drop policy if exists "super_admin write regulatory_events" on public.regulatory_events;

create policy "auth read regulatory_events"
  on public.regulatory_events for select to authenticated using (true);

create policy "super_admin write regulatory_events"
  on public.regulatory_events for all to authenticated
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

-- workflow_revisions: super_admin-only read (this is the company audit log).
-- A regular viewer guessing /admin should see nothing even if they bypass
-- the page redirect and query the table directly.
drop policy if exists "super_admin read workflow_revisions" on public.workflow_revisions;
drop policy if exists "team or admin write workflow_revisions" on public.workflow_revisions;

create policy "super_admin read workflow_revisions"
  on public.workflow_revisions for select to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

create policy "team or admin write workflow_revisions"
  on public.workflow_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_revisions.workflow_id
        and (g.role in ('super_admin','admin') or g.team = w.team)
    )
  );

-- champions: readable by any signed-in user (the freshness widget could be
-- surfaced elsewhere later); only super_admin can mutate.
drop policy if exists "auth read champions"         on public.champions;
drop policy if exists "super_admin write champions" on public.champions;

create policy "auth read champions"
  on public.champions for select to authenticated using (true);

create policy "super_admin write champions"
  on public.champions for all to authenticated
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
