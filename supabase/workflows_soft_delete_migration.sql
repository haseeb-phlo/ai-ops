-- =========================================================================
-- Phlo AI Ops - workflows soft delete
-- Run in Supabase Studio - SQL Editor. Safe to re-run.
-- Adds deleted_at + deleted_by, treats existing active=false as deleted,
-- and exposes a permission helper for the soft-delete RLS policy.
-- =========================================================================

-- 1. Columns ---------------------------------------------------------------
alter table public.workflows
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

-- 2. Backfill: rows previously marked inactive are treated as deleted.
update public.workflows
   set deleted_at = coalesce(updated_at, now())
 where active = false
   and deleted_at is null;

-- 3. Index for the common "show only live workflows" query.
create index if not exists workflows_deleted_at_idx
  on public.workflows(deleted_at)
  where deleted_at is null;

-- 4. Permission helper: who can delete or restore a given workflow?
--    super_admin, the workflow's creator, or a champion of the workflow's team.
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
  );
$$;

grant execute on function public.can_delete_workflow(uuid) to authenticated;

-- 5. Update policy: who can flip deleted_at on a workflow?
--    The existing update policy (if any) is replaced with one that requires
--    can_delete_workflow() for delete-or-restore writes; ordinary edits go
--    through other paths.
drop policy if exists "auth update workflows" on public.workflows;
create policy "auth update workflows"
  on public.workflows
  for update
  to authenticated
  using (public.can_delete_workflow(id))
  with check (public.can_delete_workflow(id));

notify pgrst, 'reload schema';
