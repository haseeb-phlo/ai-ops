-- =========================================================================
-- Phlo AI Ops - audit-trail integrity (additive)
-- Run AFTER interventions_migration.sql, interventions_edit_migration.sql,
-- profiles_and_history_migration.sql. Safe to re-run.
--
-- Two concerns:
--
-- 1. Several insert policies were `with check (true)`, so a logged-in user
--    could POST to /rest/v1 directly with a forged created_by/actor_id and
--    impersonate authorship in the audit trail. Server Actions stamp these
--    fields correctly, but RLS didn't enforce it. Tighten so authorship is
--    bound to auth.uid() at the DB layer.
--
-- 2. Numeric metric columns had no bounds, so a single typo (£1,000,000
--    instead of £10,000) silently propagates to dashboard aggregates. Add
--    non-negative + sane upper-bound CHECK constraints. Bounds are the same
--    ones the zod schema in interventions/[id]/actions.ts enforces.
-- =========================================================================

-- 1. ai_interventions: bind authorship to auth.uid() ----------------------
-- log_intervention() RPC already sets created_by = auth.uid(); this just
-- closes the direct-REST bypass.
drop policy if exists "auth insert ai_interventions" on public.ai_interventions;
create policy "auth insert ai_interventions"
  on public.ai_interventions for insert to authenticated
  with check (created_by = auth.uid());

-- 2. intervention_metrics: bind authorship --------------------------------
drop policy if exists "auth insert intervention_metrics"
  on public.intervention_metrics;
create policy "auth insert intervention_metrics"
  on public.intervention_metrics for insert to authenticated
  with check (created_by = auth.uid());

-- 3. intervention_edits: bind actor ---------------------------------------
-- update_intervention()/set_intervention_status() RPCs are the only legit
-- writers and both stamp actor_id from auth.uid().
drop policy if exists "auth insert intervention_edits"
  on public.intervention_edits;
create policy "auth insert intervention_edits"
  on public.intervention_edits for insert to authenticated
  with check (actor_id = auth.uid());

-- 4. Bounds on intervention_metrics ---------------------------------------
alter table public.intervention_metrics
  drop constraint if exists intervention_metrics_value_bounds;
alter table public.intervention_metrics
  add constraint intervention_metrics_value_bounds check (
       (time_value    is null or (time_value    >= 0 and time_value    <=    1000000))
   and (cost_value    is null or (cost_value    >= 0 and cost_value    <=   10000000))
   and (people_value  is null or (people_value  >= 0 and people_value  <=      10000))
   and (errors_value  is null or (errors_value  >= 0 and errors_value  <=    1000000))
   and (revenue_value is null or (revenue_value >= 0 and revenue_value <=  100000000))
  );

-- 5. Same bounds on workflow_baselines (snapshotted at intervention time) -
alter table public.workflow_baselines
  drop constraint if exists workflow_baselines_value_bounds;
alter table public.workflow_baselines
  add constraint workflow_baselines_value_bounds check (
       (time_value    is null or (time_value    >= 0 and time_value    <=    1000000))
   and (cost_value    is null or (cost_value    >= 0 and cost_value    <=   10000000))
   and (people_value  is null or (people_value  >= 0 and people_value  <=      10000))
   and (errors_value  is null or (errors_value  >= 0 and errors_value  <=    1000000))
   and (revenue_value is null or (revenue_value >= 0 and revenue_value <=  100000000))
  );

-- 6. workflow_metrics_history: per-metric bound on the single value col --
alter table public.workflow_metrics_history
  drop constraint if exists wmh_value_bounds;
alter table public.workflow_metrics_history
  add constraint wmh_value_bounds check (
    value >= 0 and (
      (metric = 'time'    and value <=    1000000) or
      (metric = 'cost'    and value <=   10000000) or
      (metric = 'people'  and value <=      10000) or
      (metric = 'errors'  and value <=    1000000) or
      (metric = 'revenue' and value <=  100000000)
    )
  );

notify pgrst, 'reload schema';
