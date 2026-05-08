-- =========================================================================
-- Phlo AI Ops - roles simplification (additive)
-- Collapses the role set to two: 'super_admin' and 'member'.
--   * 'admin' → 'member'  (cross-team editing now happens via team membership
--                          + super_admin escape hatch - see workflows.sql RLS)
--   * 'editor', 'viewer' → 'member'  (these were never enforced anywhere)
-- Run AFTER admin_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Coerce existing rows so the new check constraint accepts them. -------
update public.role_grants
   set role = 'member'
 where role in ('admin', 'editor', 'viewer');

-- 2. Tighten the check constraint. ----------------------------------------
alter table public.role_grants
  drop constraint if exists role_grants_role_check;
alter table public.role_grants
  add  constraint role_grants_role_check
       check (role in ('super_admin', 'member'));

-- 3. Rewrite RLS policies that referenced 'admin' to use 'super_admin'. ---
-- workflows.sql had these five; we drop+recreate so the predicate matches
-- the new role set. Behaviour change: cross-team write access now requires
-- 'super_admin' instead of 'admin'.
drop policy if exists "team or admin update workflows" on public.workflows;
create policy "team or super_admin update workflows"
  on public.workflows for update to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
  );

drop policy if exists "team or admin update steps" on public.workflow_steps;
create policy "team or super_admin update steps"
  on public.workflow_steps for update to authenticated
  using (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  )
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  );

drop policy if exists "team or admin insert revisions" on public.step_revisions;
create policy "team or super_admin insert revisions"
  on public.step_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = step_revisions.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  );

-- 4. workflow_revisions write policy: was super_admin OR admin OR team. ---
drop policy if exists "team or admin write workflow_revisions"
  on public.workflow_revisions;
create policy "team or super_admin write workflow_revisions"
  on public.workflow_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_revisions.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  );

-- 5. Tell PostgREST to refresh its policy cache immediately. --------------
notify pgrst, 'reload schema';
