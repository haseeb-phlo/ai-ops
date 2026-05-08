-- =========================================================================
-- Phlo AI Ops - workflow_steps CRUD policies (additive)
-- The /workflows/[id] page now lets team members + super_admins add, delete,
-- and reorder steps. The original insert policy required the workflow's
-- creator (too tight); there was no delete policy at all.
-- Run AFTER roles_simplify_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Replace the over-restrictive insert policy. ---------------------------
drop policy if exists "auth insert workflow_steps" on public.workflow_steps;

create policy "team or super_admin insert workflow_steps"
  on public.workflow_steps for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  );

-- 2. New delete policy (none existed before). ------------------------------
drop policy if exists "team or super_admin delete workflow_steps"
  on public.workflow_steps;

create policy "team or super_admin delete workflow_steps"
  on public.workflow_steps for delete to authenticated
  using (
    exists (
      select 1
      from public.workflows w
      join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (g.role = 'super_admin' or g.team = w.team)
    )
  );

notify pgrst, 'reload schema';
