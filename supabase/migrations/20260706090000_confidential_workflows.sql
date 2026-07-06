-- Confidential (team-only) workflows.
--
-- Adds workflows.visibility ('org' | 'team'). 'team' rows are readable only
-- by super_admins, the creator, and people whose *directory* team
-- (public.people, matched by auth email) equals the workflow's team.
--
-- Why the people directory and not role_grants.team: role_grants.team is
-- self-service (the profile page upserts it), so any user could join a team
-- by typing its name. The people directory is writable only by super_admins
-- ("super_admin write people" policy), which makes it the trustworthy
-- membership signal for a confidentiality boundary. For the same reason the
-- read gate deliberately excludes owner_names matching (display names are
-- user-settable via profiles) and the champions table (champions can update
-- their own row, including team).

-- 1. visibility column ------------------------------------------------------

alter table public.workflows
  add column if not exists visibility text not null default 'org';

alter table public.workflows
  drop constraint if exists workflows_visibility_check;

alter table public.workflows
  add constraint workflows_visibility_check
  check (visibility in ('org', 'team'));

-- 2. role_grants integrity guard --------------------------------------------
--
-- Pre-existing hole this feature would otherwise inherit: the
-- "users insert/update own grant" policies put no restriction on the role
-- column, so any member could PATCH their own row to role = 'super_admin'
-- with a direct PostgREST call and bypass every admin/visibility gate.
-- Block role changes unless the caller is already a super_admin or the
-- write is system-initiated (service role / auth triggers, auth.uid() null).
-- Self-service team changes stay allowed - the profile page depends on them,
-- which is exactly why team confidentiality keys off the directory instead.

create or replace function public.enforce_role_grant_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (
    select 1 from public.role_grants g
    where g.user_id = auth.uid() and g.role = 'super_admin'
  ) then
    return new;
  end if;
  if tg_op = 'INSERT' and new.role is distinct from 'member' then
    raise exception 'only super admins can grant roles';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'only super admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists role_grants_integrity on public.role_grants;
create trigger role_grants_integrity
  before insert or update on public.role_grants
  for each row execute function public.enforce_role_grant_integrity();

-- 3. workflows read policy ---------------------------------------------------
--
-- Same shape as before (everyone reads non-deleted rows, super_admins also
-- read soft-deleted ones) with the new visibility gate on 'team' rows.

drop policy if exists "auth read workflows" on public.workflows;

create policy "auth read workflows" on public.workflows
  for select to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or (
      deleted_at is null
      and (
        visibility = 'org'
        or created_by = auth.uid()
        or (
          team is not null
          and exists (
            select 1 from public.people p
            where lower(p.email) = lower(coalesce(auth.email(), ''))
              and lower(btrim(p.team)) = lower(btrim(workflows.team))
          )
        )
      )
    )
  );

-- 4. restrictive update guard ------------------------------------------------
--
-- The legacy UPDATE policies ("team or super_admin or creator ...") match on
-- role_grants.team, which is self-service. Without this guard a user could
-- set their profile team to "People" and mutate a confidential row (e.g. flip
-- visibility back to 'org') given its id. Restrictive policies AND with the
-- existing permissive ones, so org-visible rows behave exactly as before.

drop policy if exists "confidential workflows update guard" on public.workflows;

create policy "confidential workflows update guard" on public.workflows
  as restrictive for update to authenticated
  using (
    visibility = 'org'
    or created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or (
      team is not null
      and exists (
        select 1 from public.people p
        where lower(p.email) = lower(coalesce(auth.email(), ''))
          and lower(btrim(p.team)) = lower(btrim(workflows.team))
      )
    )
  );

-- 5. child tables inherit workflow visibility --------------------------------
--
-- These read policies were USING (true), which would leak a confidential
-- workflow's steps, metrics and revision text to everyone. An EXISTS against
-- public.workflows is evaluated under the caller's RLS, so each child row is
-- readable exactly when its parent workflow is. (Write policies already join
-- public.workflows and therefore tighten automatically.)

drop policy if exists "auth read workflow_steps" on public.workflow_steps;
create policy "auth read workflow_steps" on public.workflow_steps
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = workflow_steps.workflow_id)
  );

drop policy if exists "auth read workflow_metrics" on public.workflow_metrics;
create policy "auth read workflow_metrics" on public.workflow_metrics
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = workflow_metrics.workflow_id)
  );

drop policy if exists "wmh read all" on public.workflow_metrics_history;
create policy "wmh read all" on public.workflow_metrics_history
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = workflow_metrics_history.workflow_id)
  );

drop policy if exists "auth read workflow_baselines" on public.workflow_baselines;
create policy "auth read workflow_baselines" on public.workflow_baselines
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = workflow_baselines.workflow_id)
  );

drop policy if exists "auth read step_revisions" on public.step_revisions;
create policy "auth read step_revisions" on public.step_revisions
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = step_revisions.workflow_id)
  );

drop policy if exists "auth read intervention_workflows" on public.intervention_workflows;
create policy "auth read intervention_workflows" on public.intervention_workflows
  for select to authenticated
  using (
    exists (select 1 from public.workflows w where w.id = intervention_workflows.workflow_id)
  );

drop policy if exists "auth read regulatory_events" on public.regulatory_events;
create policy "auth read regulatory_events" on public.regulatory_events
  for select to authenticated
  using (
    workflow_id is null
    or exists (select 1 from public.workflows w where w.id = regulatory_events.workflow_id)
  );
