-- =========================================================================
-- Phlo AI Ops - intervention recipients (who the intervention reached)
--
-- Adds an array of canonical emails to ai_interventions so we can track who
-- a given intervention was rolled out to, separately from the workflow it
-- targets. This unlocks per-person adoption / sentiment analysis later
-- (champion auto-detect, drop-off flagging, reach-by-team) without coupling
-- it to the workflow ownership model.
--
-- Storing emails (rather than user_ids) keeps the data resilient to
-- profiles being created/deleted later: the canonical key is the company
-- email, which is also what public.people uses.
--
-- The log_intervention RPC is rebuilt to accept the new array. Run AFTER
-- intervention_adoption_satisfaction_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Column ----------------------------------------------------------------
alter table public.ai_interventions
  add column if not exists recipient_emails text[] not null default '{}';

create index if not exists ai_interventions_recipient_emails_gin
  on public.ai_interventions using gin (recipient_emails);

-- 2. Rebuild log_intervention RPC with the new optional param --------------
-- Drop previous (10-arg) signature first.
drop function if exists public.log_intervention(
  text, text, uuid[], text, numeric, text, numeric, numeric, text, smallint
);

create or replace function public.log_intervention(
  p_name text,
  p_type text,
  p_workflow_ids uuid[],
  p_description text default null,
  p_minutes_saved_per_week numeric default null,
  p_attribution_confidence text default 'medium',
  p_estimated_gbp_saved_per_week numeric default null,
  p_estimated_revenue_per_week    numeric default null,
  p_adoption_status text default null,
  p_satisfaction    smallint default null,
  p_recipient_emails text[] default '{}'
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
  v_recipients      text[];
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

  if p_adoption_status is not null
     and p_adoption_status not in ('daily','weekly','occasional','abandoned') then
    raise exception 'Invalid adoption_status: %', p_adoption_status
      using errcode = '22023';
  end if;

  if p_satisfaction is not null and (p_satisfaction < 1 or p_satisfaction > 5) then
    raise exception 'satisfaction must be between 1 and 5'
      using errcode = '22023';
  end if;

  -- Normalise recipient emails to lowercased + de-duped, dropping empties.
  -- Anything unknown to public.people is dropped server-side so a typo on
  -- the client can't introduce a phantom recipient.
  if p_recipient_emails is null then
    v_recipients := '{}';
  else
    select coalesce(array_agg(distinct lower(trim(e))), '{}')
      into v_recipients
      from unnest(p_recipient_emails) as e
     where e is not null
       and length(trim(e)) > 0
       and exists (
         select 1 from public.people p
          where lower(p.email) = lower(trim(e))
       );
  end if;

  v_owner := auth.jwt() ->> 'email';

  insert into public.ai_interventions
        (name, type, description, status, owner,
         minutes_saved_per_week, attribution_confidence,
         estimated_gbp_saved_per_week, estimated_revenue_per_week,
         adoption_status, satisfaction,
         recipient_emails,
         created_by)
  values (p_name, p_type, p_description, 'active', v_owner,
          p_minutes_saved_per_week, p_attribution_confidence,
          p_estimated_gbp_saved_per_week, p_estimated_revenue_per_week,
          p_adoption_status, p_satisfaction,
          v_recipients,
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
        (intervention_id, snapshot_date,
         adoption_status, satisfaction,
         created_by)
  values (v_intervention_id, current_date,
          p_adoption_status, p_satisfaction,
          v_user_id);

  return v_intervention_id;
end;
$$;

grant execute on function public.log_intervention(
  text, text, uuid[], text, numeric, text, numeric, numeric, text, smallint, text[]
) to authenticated;

notify pgrst, 'reload schema';
