-- =========================================================================
-- Phlo AI Ops - permissions repair
-- Run this if you see "permission denied for table <name>" anywhere.
-- Fixes BOTH layers:
--   (1) GRANT - table-level privileges for the `authenticated` role.
--   (2) RLS  - read + insert policies the app needs.
-- Idempotent - safe to re-run.
-- =========================================================================

-- 0. GRANT: give the `authenticated` role the basic table privileges -------
-- Without these, RLS never even gets consulted - Postgres rejects the
-- request at the GRANT layer with "permission denied for table <name>".
grant usage on schema public to authenticated;

grant select, insert, update          on public.role_grants           to authenticated;
grant select, insert, update, delete on public.workflows              to authenticated;
grant select, insert, update, delete on public.workflow_steps         to authenticated;
grant select, insert, update, delete on public.step_revisions         to authenticated;
grant select, insert, update, delete on public.workflow_metrics       to authenticated;
grant select, insert, update, delete on public.ai_interventions       to authenticated;
grant select, insert, update, delete on public.intervention_workflows to authenticated;

-- These only exist after later migrations; guard with DO blocks.
do $$
begin
  if to_regclass('public.workflow_baselines') is not null then
    execute 'grant select, insert, update, delete on public.workflow_baselines to authenticated';
  end if;
  if to_regclass('public.intervention_metrics') is not null then
    execute 'grant select, insert, update, delete on public.intervention_metrics to authenticated';
  end if;
  if to_regclass('public.profiles') is not null then
    execute 'grant select, insert, update on public.profiles to authenticated';
  end if;
  if to_regclass('public.workflow_metrics_history') is not null then
    execute 'grant select, insert on public.workflow_metrics_history to authenticated';
  end if;
end $$;

-- Make any future tables in public auto-grant to authenticated too.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- 1. Make sure RLS is enabled on every table the app touches ---------------
alter table public.workflows              enable row level security;
alter table public.workflow_steps         enable row level security;
alter table public.step_revisions         enable row level security;
alter table public.workflow_metrics       enable row level security;
alter table public.ai_interventions       enable row level security;
alter table public.intervention_workflows enable row level security;

-- 2. Read policies - every signed-in user can read --------------------------
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

-- 4. role_grants: self-service team selection -------------------------------
-- Each user can insert their own grant row (the signup trigger normally
-- handles this, but the upsert in /profile needs an explicit policy) and
-- update their own row to change `team`.
drop policy if exists "users insert own grant" on public.role_grants;
drop policy if exists "users update own grant" on public.role_grants;

create policy "users insert own grant"
  on public.role_grants for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users update own grant"
  on public.role_grants for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Make sure PostgREST notices the changes immediately --------------------
notify pgrst, 'reload schema';
