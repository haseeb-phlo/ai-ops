-- =========================================================================
-- Phlo AI Ops - clear seeded sample data
--
-- Wipes the demo / seed rows so the production dashboard only shows real,
-- logged content. This goes beyond ai_interventions because the dashboard's
-- Needs Attention and Recent Activity rails also pull from regulatory
-- events, workflow metric snapshots, and champion notes - if those still
-- contain seed rows, the dashboard keeps surfacing items even after sample
-- interventions have been removed.
--
-- Order is FK-aware: drop dependents first, parents last. workflows,
-- people, role_grants, profiles, and champions are left intact.
--
-- Safe to re-run.
-- =========================================================================

begin;

-- 1. Snapshot histories + per-snapshot extras
delete from public.workflow_metrics_history;
delete from public.intervention_metrics;

-- 2. Per-intervention join + baseline rows
delete from public.intervention_workflows;
delete from public.workflow_baselines;
delete from public.intervention_edits;

-- 3. Suggestions linked to interventions (so the parent FK is free to cascade)
do $$
begin
  if exists (select 1 from pg_class where relname = 'intervention_suggestions' and relkind = 'r') then
    -- Detach any shipped suggestions from the intervention they reference,
    -- then mark them open so they're not orphaned in a "shipped" status
    -- pointing at a row that's about to be deleted.
    execute 'update public.intervention_suggestions set intervention_id = null, status = ''open'' where intervention_id is not null';
  end if;
end $$;

-- 4. Co-sign + champion notes - clear ALL champion notes since both
-- workflow- and intervention-targeted ones surface in Recent Activity.
do $$
begin
  if exists (select 1 from pg_class where relname = 'intervention_cosigns' and relkind = 'r') then
    execute 'delete from public.intervention_cosigns';
  end if;
end $$;
delete from public.champion_notes;

-- 5. Regulatory events drive Needs Attention - clear them too
delete from public.regulatory_events;

-- 6. Finally the interventions themselves
delete from public.ai_interventions;

commit;
