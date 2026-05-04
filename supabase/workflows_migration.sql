-- =========================================================================
-- Phlo AI Ops - workflows migration (additive)
-- Run this in Supabase Studio → SQL Editor AFTER schema.sql + workflows.sql.
-- Safe to re-run.
-- =========================================================================

-- 1. Add the columns the /workflows UI needs --------------------------------
alter table public.workflows
  add column if not exists frequency_per_week numeric default 0
        check (frequency_per_week >= 0),
  add column if not exists criticality_score  int default 3
        check (criticality_score between 1 and 5),
  add column if not exists walkthrough        text,
  add column if not exists active             boolean not null default true,
  add column if not exists created_by         uuid references auth.users(id);

create index if not exists workflows_team_idx   on public.workflows(team);
create index if not exists workflows_active_idx on public.workflows(active);

-- 2. Insert policies (existing schema has read + update, but no inserts) ----
drop policy if exists "auth insert workflows"      on public.workflows;
drop policy if exists "auth insert workflow_steps" on public.workflow_steps;

create policy "auth insert workflows"
  on public.workflows for insert to authenticated
  with check (created_by = auth.uid());

create policy "auth insert workflow_steps"
  on public.workflow_steps for insert to authenticated
  with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_steps.workflow_id
        and w.created_by = auth.uid()
    )
  );

-- Refresh PostgREST's schema cache so the new tables/policies are visible.
notify pgrst, 'reload schema';
