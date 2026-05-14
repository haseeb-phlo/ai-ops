-- =========================================================================
-- Phlo AI Ops - workflow_steps insert policy: include the workflow creator
--
-- workflow_steps_crud_migration.sql narrowed step inserts to team members
-- and super_admins, but the workflows insert policy still lets any signed-in
-- user create a workflow row (check: created_by = auth.uid()). That left a
-- hole in the "create workflow" Server Action: the workflow row inserts,
-- then the matching workflow_steps inserts fail RLS for any user who isn't
-- on the chosen team (and isn't a super_admin) - including users with no
-- role_grants row at all. Result: workflow saves with zero steps.
--
-- This adds the creator predicate so the same user who just inserted the
-- workflow can seed its steps in the same flow. Update and delete still
-- require team membership / super_admin, which is the intent of the CRUD
-- migration.
--
-- Run AFTER workflow_steps_crud_migration.sql. Safe to re-run.
-- =========================================================================

drop policy if exists "team or super_admin insert workflow_steps"
  on public.workflow_steps;
drop policy if exists "team or super_admin or creator insert workflow_steps"
  on public.workflow_steps;

create policy "team or super_admin or creator insert workflow_steps"
  on public.workflow_steps for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      left join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_steps.workflow_id
        and (
          w.created_by = auth.uid()
          or g.role = 'super_admin'
          or g.team = w.team
        )
    )
  );

notify pgrst, 'reload schema';
