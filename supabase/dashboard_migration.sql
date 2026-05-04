-- =========================================================================
-- Phlo AI Ops — dashboard migration (additive)
-- Adds attribution_confidence so the company-wide /dashboard can weight
-- savings honestly. Run AFTER interventions_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. attribution_confidence on ai_interventions ---------------------------
alter table public.ai_interventions
  add column if not exists attribution_confidence text;

-- Existing rows pre-dating this column are 'medium' — sensible neutral
-- default that doesn't claim more credit than we can defend.
update public.ai_interventions
   set attribution_confidence = 'medium'
 where attribution_confidence is null;

alter table public.ai_interventions
  alter column attribution_confidence set default 'medium';

alter table public.ai_interventions
  drop constraint if exists ai_interventions_confidence_check;
alter table public.ai_interventions
  add  constraint ai_interventions_confidence_check
       check (attribution_confidence in ('high', 'medium', 'low'));

-- 2. Update log_intervention RPC to accept p_attribution_confidence -------
-- Drop the old signature first so we can re-create with the new arg list.
drop function if exists public.log_intervention(text, text, uuid[], text, numeric);

create or replace function public.log_intervention(
  p_name text,
  p_type text,
  p_workflow_ids uuid[],
  p_description text default null,
  p_minutes_saved_per_week numeric default null,
  p_attribution_confidence text default 'medium'
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

  select email into v_owner from auth.users where id = v_user_id;

  insert into public.ai_interventions
        (name, type, description, status, owner, minutes_saved_per_week,
         attribution_confidence, created_by)
  values (p_name, p_type, p_description, 'active', v_owner,
          p_minutes_saved_per_week, p_attribution_confidence, v_user_id)
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

grant execute on function public.log_intervention(text, text, uuid[], text, numeric, text)
  to authenticated;
