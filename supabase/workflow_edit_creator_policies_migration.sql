-- =========================================================================
-- Phlo AI Ops - allow workflow creators to edit their own workflows
--
-- workflow_steps_creator_insert_migration.sql let creators *insert* steps,
-- but the matching update / delete / revision-insert policies still only
-- accepted super_admin or a literal team match on role_grants.team. That
-- left a half-broken edit flow: creator clicks "Add step", the row inserts
-- ("New step"), then renaming it fails RLS on step_revisions:
--   "new row violates row-level security policy for table 'step_revisions'"
--
-- canUserEditWorkflow (app/(protected)/workflows/[id]/permissions.ts) already
-- treats workflow.created_by = auth.uid() as edit permission. These policies
-- bring the DB in line so the app and RLS agree on who can edit.
--
-- Touches:
--   * workflows                 update
--   * workflow_steps            update + delete
--   * step_revisions            insert
--   * workflow_revisions        insert
--
-- Run AFTER workflow_steps_creator_insert_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. workflows update -----------------------------------------------------
drop policy if exists "team or super_admin update workflows" on public.workflows;
drop policy if exists "team or super_admin or creator update workflows"
  on public.workflows;

create policy "team or super_admin or creator update workflows"
  on public.workflows for update to authenticated
  using (
    workflows.created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
  )
  with check (
    workflows.created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
  );

-- 2. workflow_steps update ------------------------------------------------
drop policy if exists "team or super_admin update steps" on public.workflow_steps;
drop policy if exists "team or super_admin or creator update steps"
  on public.workflow_steps;

create policy "team or super_admin or creator update steps"
  on public.workflow_steps for update to authenticated
  using (
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
  )
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

-- 3. workflow_steps delete ------------------------------------------------
drop policy if exists "team or super_admin delete workflow_steps"
  on public.workflow_steps;
drop policy if exists "team or super_admin or creator delete workflow_steps"
  on public.workflow_steps;

create policy "team or super_admin or creator delete workflow_steps"
  on public.workflow_steps for delete to authenticated
  using (
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

-- 4. step_revisions insert ------------------------------------------------
drop policy if exists "team or super_admin insert revisions"
  on public.step_revisions;
drop policy if exists "team or super_admin or creator insert revisions"
  on public.step_revisions;

create policy "team or super_admin or creator insert revisions"
  on public.step_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      left join public.role_grants g on g.user_id = auth.uid()
      where w.id = step_revisions.workflow_id
        and (
          w.created_by = auth.uid()
          or g.role = 'super_admin'
          or g.team = w.team
        )
    )
  );

-- 5. workflow_revisions insert --------------------------------------------
drop policy if exists "team or super_admin write workflow_revisions"
  on public.workflow_revisions;
drop policy if exists "team or super_admin or creator write workflow_revisions"
  on public.workflow_revisions;

create policy "team or super_admin or creator write workflow_revisions"
  on public.workflow_revisions for insert to authenticated
  with check (
    exists (
      select 1
      from public.workflows w
      left join public.role_grants g on g.user_id = auth.uid()
      where w.id = workflow_revisions.workflow_id
        and (
          w.created_by = auth.uid()
          or g.role = 'super_admin'
          or g.team = w.team
        )
    )
  );

notify pgrst, 'reload schema';
