-- =========================================================================
-- Phlo AI Ops - workflow_metrics write policies
--
-- workflow_metrics had RLS enabled but only a SELECT policy. The
-- createWorkflow server action upserts a baseline row right after the
-- workflow row is inserted (hours/cost/revenue from the dialog), and that
-- upsert was silently rejected by RLS - the action logs the error and
-- carries on, so the workflow appeared in the list but its "Total hours"
-- and other baselines were never persisted.
--
-- Add INSERT + UPDATE policies. Authenticated users can write any
-- workflow_metrics row: this is an internal tool, the application is the
-- one deciding which workflow's metrics to seed, and column-level RLS on
-- this table would just push complexity for no real safety win.
--
-- Safe to re-run.
-- =========================================================================

drop policy if exists "auth insert workflow_metrics" on public.workflow_metrics;
drop policy if exists "auth update workflow_metrics" on public.workflow_metrics;

create policy "auth insert workflow_metrics"
  on public.workflow_metrics for insert to authenticated
  with check (true);

create policy "auth update workflow_metrics"
  on public.workflow_metrics for update to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
