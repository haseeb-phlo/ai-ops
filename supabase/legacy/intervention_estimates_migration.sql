-- =========================================================================
-- Phlo AI Ops - intervention estimates
--
-- Adds estimated_gbp_saved_per_week and estimated_revenue_per_week to
-- ai_interventions, and extends the log_intervention RPC to accept them.
-- These are "guess at log time" numbers that show up on the intervention
-- card immediately, before any metric snapshot is logged.
--
-- Run AFTER dashboard_migration.sql. Safe to re-run.
-- =========================================================================

alter table public.ai_interventions
  add column if not exists estimated_gbp_saved_per_week numeric,
  add column if not exists estimated_revenue_per_week    numeric;

-- Replace the 6-arg RPC with an 8-arg version. Drop first so the call site
-- isn't ambiguous.
drop function if exists public.log_intervention(
  text, text, uuid[], text, numeric, text
);

create or replace function public.log_intervention(
  p_name text,
  p_type text,
  p_workflow_ids uuid[],
  p_description text default null,
  p_minutes_saved_per_week numeric default null,
  p_attribution_confidence text default 'medium',
  p_estimated_gbp_saved_per_week numeric default null,
  p_estimated_revenue_per_week    numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id         uuid := auth.uid();
  v_owner           text;
  v_intervention_id uuid;
  v_workflow_id     uuid;
  v_metrics         public.workflow_metrics%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_workflow_ids is null or array_length(p_workflow_ids, 1) is null then
    raise exception 'At least one workflow is required' using errcode = '22023';
  end if;

  if p_type not in ('tool','training','prompt','agent','automation','process_change') then
    raise exception 'Invalid intervention type: %', p_type using errcode = '22023';
  end if;

  if p_attribution_confidence not in ('high','medium','low') then
    raise exception 'Invalid attribution_confidence: %', p_attribution_confidence
      using errcode = '22023';
  end if;

  v_owner := auth.jwt() ->> 'email';

  insert into public.ai_interventions
        (name, type, description, status, owner,
         minutes_saved_per_week, attribution_confidence,
         estimated_gbp_saved_per_week, estimated_revenue_per_week,
         created_by)
  values (p_name, p_type, p_description, 'active', v_owner,
          p_minutes_saved_per_week, p_attribution_confidence,
          p_estimated_gbp_saved_per_week, p_estimated_revenue_per_week,
          v_user_id)
  returning id into v_intervention_id;

  foreach v_workflow_id in array p_workflow_ids
  loop
    insert into public.intervention_workflows (intervention_id, workflow_id)
    values (v_intervention_id, v_workflow_id)
    on conflict do nothing;

    select * into v_metrics
      from public.workflow_metrics
     where workflow_id = v_workflow_id;

    insert into public.workflow_baselines
          (workflow_id, intervention_id,
           time_value, cost_value, people_value, errors_value, revenue_value)
    values (v_workflow_id, v_intervention_id,
            coalesce(v_metrics.time_current,    v_metrics.time_baseline,    0),
            coalesce(v_metrics.cost_current,    v_metrics.cost_baseline,    0),
            coalesce(v_metrics.people_current,  v_metrics.people_baseline,  0),
            coalesce(v_metrics.errors_current,  v_metrics.errors_baseline,  0),
            coalesce(v_metrics.revenue_current, v_metrics.revenue_baseline, 0));
  end loop;

  insert into public.intervention_metrics
        (intervention_id, snapshot_date, created_by)
  values (v_intervention_id, current_date, v_user_id);

  return v_intervention_id;
end;
$$;

grant execute on function public.log_intervention(
  text, text, uuid[], text, numeric, text, numeric, numeric
) to authenticated;

notify pgrst, 'reload schema';
