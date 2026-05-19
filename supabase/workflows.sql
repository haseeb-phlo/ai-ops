-- =========================================================================
-- Phlo AI Ops - workflows schema
-- Run this in Supabase Studio → SQL Editor after schema.sql.
-- Safe to re-run (uses "if not exists" / "drop policy if exists").
-- =========================================================================

-- 1. workflows -------------------------------------------------------------
create table if not exists public.workflows (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  team          text,
  regulatory    boolean not null default false,
  frequency     text,
  criticality   text check (criticality in ('low','medium','high','critical')),
  business_kpi  text,
  owner_names   text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. workflow_steps --------------------------------------------------------
create table if not exists public.workflow_steps (
  id               uuid primary key default gen_random_uuid(),
  workflow_id      uuid not null references public.workflows(id) on delete cascade,
  position         int  not null,
  title            text not null,
  description      text,
  owner            text,
  duration_minutes int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists workflow_steps_workflow_idx
  on public.workflow_steps (workflow_id, position);

-- 3. step_revisions (audit trail for inline edits) ------------------------
create table if not exists public.step_revisions (
  id               uuid primary key default gen_random_uuid(),
  step_id          uuid not null references public.workflow_steps(id) on delete cascade,
  workflow_id      uuid not null references public.workflows(id) on delete cascade,
  field            text not null,
  old_value        text,
  new_value        text,
  changed_by       uuid references auth.users(id),
  changed_by_email text,
  changed_at       timestamptz not null default now()
);

create index if not exists step_revisions_workflow_idx
  on public.step_revisions (workflow_id, changed_at desc);

-- 4. workflow_metrics (one row per workflow, 5 paired metrics) ------------
create table if not exists public.workflow_metrics (
  workflow_id      uuid primary key references public.workflows(id) on delete cascade,
  time_baseline    numeric, time_current    numeric,
  cost_baseline    numeric, cost_current    numeric,
  people_baseline  numeric, people_current  numeric,
  errors_baseline  numeric, errors_current  numeric,
  revenue_baseline numeric, revenue_current numeric,
  updated_at       timestamptz not null default now()
);

-- 5. ai_interventions + join table ----------------------------------------
create table if not exists public.ai_interventions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.intervention_workflows (
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  workflow_id     uuid not null references public.workflows(id) on delete cascade,
  primary key (intervention_id, workflow_id)
);

-- 6. Row-level security ----------------------------------------------------
alter table public.workflows              enable row level security;
alter table public.workflow_steps         enable row level security;
alter table public.step_revisions         enable row level security;
alter table public.workflow_metrics       enable row level security;
alter table public.ai_interventions       enable row level security;
alter table public.intervention_workflows enable row level security;

-- Read policies: any signed-in user can read.
drop policy if exists "auth read workflows"              on public.workflows;
drop policy if exists "auth read workflow_steps"         on public.workflow_steps;
drop policy if exists "auth read step_revisions"         on public.step_revisions;
drop policy if exists "auth read workflow_metrics"       on public.workflow_metrics;
drop policy if exists "auth read ai_interventions"       on public.ai_interventions;
drop policy if exists "auth read intervention_workflows" on public.intervention_workflows;

-- Soft-deleted workflows are hidden from non-super-admin reads. See
-- workflows_read_soft_delete_migration.sql for the full reasoning.
create policy "auth read workflows"
  on public.workflows for select to authenticated
  using (
    deleted_at is null
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );
create policy "auth read workflow_steps"         on public.workflow_steps         for select to authenticated using (true);
create policy "auth read step_revisions"         on public.step_revisions         for select to authenticated using (true);
create policy "auth read workflow_metrics"       on public.workflow_metrics       for select to authenticated using (true);
create policy "auth read ai_interventions"       on public.ai_interventions       for select to authenticated using (true);
create policy "auth read intervention_workflows" on public.intervention_workflows for select to authenticated using (true);

-- Write policies for the inline-edit + header-edit flows.
-- Members of the owning team (or admins) can update workflows + their steps,
-- and insert step_revisions.
drop policy if exists "team or admin update workflows"   on public.workflows;
drop policy if exists "team or admin update steps"       on public.workflow_steps;
drop policy if exists "team or admin insert revisions"   on public.step_revisions;

create policy "team or admin update workflows"
  on public.workflows for update to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'admin' or g.team = workflows.team)
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'admin' or g.team = workflows.team)
    )
  );

create policy "team or admin update steps"
  on public.workflow_steps for update to authenticated
  using (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'admin' or g.team = w.team)
    )
  )
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'admin' or g.team = w.team)
    )
  );

create policy "team or admin insert revisions"
  on public.step_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = step_revisions.workflow_id
        and (g.role = 'admin' or g.team = w.team)
    )
  );
