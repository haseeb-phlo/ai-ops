-- =========================================================================
-- Phlo AI Ops - owner_names grants edit/delete rights via RLS
--
-- canUserEditWorkflow (app/(protected)/workflows/[id]/permissions.ts) lets
-- a caller edit a workflow when their display_name, email, or email-local-
-- part matches an entry in workflow.owner_names. The DB had no matching
-- policy: the UI would show Edit/Delete buttons to a "name-owner" who isn't
-- on the workflow's team and didn't create it, then the mutation failed
-- with:
--   "new row violates row-level security policy for table 'workflows'"
--
-- This migration adds a SECURITY DEFINER helper that builds the same
-- candidate-name set the app builds (profile display_name, people directory
-- display_name, email, email-local-part), case-insensitive and trimmed, and
-- matches it against workflow.owner_names. It then ORs that match into the
-- relevant update / delete / revision-insert policies and into
-- can_delete_workflow(), so name-based ownership grants the same write
-- access the UI implies.
--
-- Run AFTER workflow_edit_creator_policies_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Helper: is the caller listed in workflow.owner_names? -----------------
--    SECURITY DEFINER so it can read profiles/people/auth.users without
--    being subject to the caller's row-level policies. The function only
--    reveals a boolean about the caller's own identity.
create or replace function public.is_workflow_name_owner(p_workflow_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_owner_names text[];
  v_email       text;
  v_match       boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select w.owner_names into v_owner_names
    from public.workflows w
   where w.id = p_workflow_id;

  if v_owner_names is null or array_length(v_owner_names, 1) is null then
    return false;
  end if;

  select au.email into v_email
    from auth.users au
   where au.id = auth.uid();

  if v_email is null or v_email = '' then
    return false;
  end if;

  with names as (
    select lower(trim(p.display_name)) as n
      from public.profiles p
     where p.user_id = auth.uid()
       and p.display_name is not null
    union
    select lower(trim(pe.display_name))
      from public.people pe
     where lower(pe.email) = lower(v_email)
       and pe.display_name is not null
    union
    select lower(trim(v_email))
    union
    select lower(trim(split_part(v_email, '@', 1)))
  ),
  candidates as (
    select n from names where n is not null and n <> ''
  )
  select exists (
    select 1
      from unnest(v_owner_names) as o(name)
      join candidates c on c.n = lower(trim(o.name))
  ) into v_match;

  return coalesce(v_match, false);
end;
$$;

grant execute on function public.is_workflow_name_owner(uuid) to authenticated;

-- 2. can_delete_workflow: accept name-owners --------------------------------
create or replace function public.can_delete_workflow(p_workflow_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = public
as $$
  select coalesce(
    (select exists (
       select 1 from public.role_grants g
       where g.user_id = auth.uid()
         and g.role = 'super_admin'
     )),
    false
  )
  or coalesce(
    (select w.created_by = auth.uid()
       from public.workflows w
      where w.id = p_workflow_id),
    false
  )
  or coalesce(
    (select exists (
       select 1
         from public.workflows w
         join public.champions c
           on c.team = w.team
          and c.user_id = auth.uid()
        where w.id = p_workflow_id
     )),
    false
  )
  or public.is_workflow_name_owner(p_workflow_id);
$$;

grant execute on function public.can_delete_workflow(uuid) to authenticated;

-- 3. workflows update -------------------------------------------------------
drop policy if exists "team or super_admin or creator update workflows"
  on public.workflows;
drop policy if exists "team or super_admin or creator or owner update workflows"
  on public.workflows;

create policy "team or super_admin or creator or owner update workflows"
  on public.workflows for update to authenticated
  using (
    workflows.created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
    or public.is_workflow_name_owner(workflows.id)
  )
  with check (
    workflows.created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid()
        and (g.role = 'super_admin' or g.team = workflows.team)
    )
    or public.is_workflow_name_owner(workflows.id)
  );

-- 4. workflow_steps insert -------------------------------------------------
drop policy if exists "team or super_admin or creator insert workflow_steps"
  on public.workflow_steps;
drop policy if exists "team or super_admin or creator or owner insert workflow_steps"
  on public.workflow_steps;

create policy "team or super_admin or creator or owner insert workflow_steps"
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
    or public.is_workflow_name_owner(workflow_steps.workflow_id)
  );

-- 5. workflow_steps update -------------------------------------------------
drop policy if exists "team or super_admin or creator update steps"
  on public.workflow_steps;
drop policy if exists "team or super_admin or creator or owner update steps"
  on public.workflow_steps;

create policy "team or super_admin or creator or owner update steps"
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
    or public.is_workflow_name_owner(workflow_steps.workflow_id)
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
    or public.is_workflow_name_owner(workflow_steps.workflow_id)
  );

-- 6. workflow_steps delete -------------------------------------------------
drop policy if exists "team or super_admin or creator delete workflow_steps"
  on public.workflow_steps;
drop policy if exists "team or super_admin or creator or owner delete workflow_steps"
  on public.workflow_steps;

create policy "team or super_admin or creator or owner delete workflow_steps"
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
    or public.is_workflow_name_owner(workflow_steps.workflow_id)
  );

-- 7. step_revisions insert -------------------------------------------------
drop policy if exists "team or super_admin or creator insert revisions"
  on public.step_revisions;
drop policy if exists "team or super_admin or creator or owner insert revisions"
  on public.step_revisions;

create policy "team or super_admin or creator or owner insert revisions"
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
    or public.is_workflow_name_owner(step_revisions.workflow_id)
  );

-- 8. workflow_revisions insert ---------------------------------------------
drop policy if exists "team or super_admin or creator write workflow_revisions"
  on public.workflow_revisions;
drop policy if exists "team or super_admin or creator or owner write workflow_revisions"
  on public.workflow_revisions;

create policy "team or super_admin or creator or owner write workflow_revisions"
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
    or public.is_workflow_name_owner(workflow_revisions.workflow_id)
  );

notify pgrst, 'reload schema';
