-- =========================================================================
-- Phlo AI Ops — permissions repair
-- Run this if /workflows shows "permission denied for table workflows".
-- That error means the table exists but its RLS read policy is missing.
-- This script (re)creates every read policy the app needs. Idempotent.
-- =========================================================================

-- 1. Make sure RLS is enabled on every table the app touches ---------------
alter table public.workflows              enable row level security;
alter table public.workflow_steps         enable row level security;
alter table public.step_revisions         enable row level security;
alter table public.workflow_metrics       enable row level security;
alter table public.ai_interventions       enable row level security;
alter table public.intervention_workflows enable row level security;

-- 2. Read policies — every signed-in user can read --------------------------
drop policy if exists "auth read workflows"              on public.workflows;
drop policy if exists "auth read workflow_steps"         on public.workflow_steps;
drop policy if exists "auth read step_revisions"         on public.step_revisions;
drop policy if exists "auth read workflow_metrics"       on public.workflow_metrics;
drop policy if exists "auth read ai_interventions"       on public.ai_interventions;
drop policy if exists "auth read intervention_workflows" on public.intervention_workflows;

create policy "auth read workflows"              on public.workflows              for select to authenticated using (true);
create policy "auth read workflow_steps"         on public.workflow_steps         for select to authenticated using (true);
create policy "auth read step_revisions"         on public.step_revisions         for select to authenticated using (true);
create policy "auth read workflow_metrics"       on public.workflow_metrics       for select to authenticated using (true);
create policy "auth read ai_interventions"       on public.ai_interventions       for select to authenticated using (true);
create policy "auth read intervention_workflows" on public.intervention_workflows for select to authenticated using (true);

-- 3. Insert policies for the create flows ----------------------------------
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

-- 4. Make sure PostgREST notices the changes immediately --------------------
notify pgrst, 'reload schema';
