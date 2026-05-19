-- =========================================================================
-- Phlo AI Ops - hide soft-deleted workflows from non-super-admin reads
--
-- workflows_soft_delete_migration.sql added the deleted_at column and an
-- update policy gating delete/restore on can_delete_workflow(). It did NOT
-- update the SELECT policy: the legacy `auth read workflows` policy uses
-- `using (true)`, so soft-deleted rows still surface for any query that
-- forgets the `.is("deleted_at", null)` filter (and they do leak via the
-- REST API for the same reason).
--
-- This migration replaces the SELECT policy with one that:
--   - lets super_admins see every row (admin/page.tsx needs deleted rows
--     for the Deleted workflows panel + restore action),
--   - lets everyone else see only rows where deleted_at IS NULL.
--
-- Safe to re-run.
-- =========================================================================

drop policy if exists "auth read workflows" on public.workflows;

create policy "auth read workflows"
  on public.workflows
  for select
  to authenticated
  using (
    deleted_at is null
    or exists (
      select 1
        from public.role_grants g
       where g.user_id = auth.uid()
         and g.role = 'super_admin'
    )
  );

notify pgrst, 'reload schema';
