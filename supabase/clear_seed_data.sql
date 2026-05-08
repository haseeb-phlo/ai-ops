-- =========================================================================
-- Phlo AI Ops - clear ALL seeded sample data
--
-- One-shot wipe of every demo / seed row across the registry so the
-- production map + dashboard only show real, logged content. Goes further
-- than clear_seed_interventions.sql: also drops sample workflows and their
-- step + baseline rows so the galaxy view starts empty.
--
-- Order is FK-aware: drop dependents first, parents last. Identity tables
-- (people, profiles, role_grants, champions) are left intact.
--
-- Safe to re-run.
-- =========================================================================

begin;

-- 1. Suggestion linkage (defensively detach before parents disappear)
do $$
begin
  if exists (select 1 from pg_class where relname = 'intervention_suggestions' and relkind = 'r') then
    execute 'update public.intervention_suggestions set intervention_id = null, status = ''open'' where intervention_id is not null';
  end if;
end $$;

-- 2. Snapshot histories + per-snapshot extras
delete from public.workflow_metrics_history;
delete from public.intervention_metrics;

-- 3. Per-intervention join + baseline rows
delete from public.intervention_workflows;
delete from public.workflow_baselines;
delete from public.intervention_edits;

-- 4. Co-sign + champion notes (both workflow- and intervention-targeted)
do $$
begin
  if exists (select 1 from pg_class where relname = 'intervention_cosigns' and relkind = 'r') then
    execute 'delete from public.intervention_cosigns';
  end if;
end $$;
delete from public.champion_notes;

-- 5. Regulatory events
delete from public.regulatory_events;

-- 6. Interventions
delete from public.ai_interventions;

-- 7. Workflows + their steps + per-workflow metrics rows
delete from public.workflow_steps;
delete from public.workflow_metrics;
delete from public.workflows;

commit;
