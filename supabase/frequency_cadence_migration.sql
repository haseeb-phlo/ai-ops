-- =========================================================================
-- Phlo AI Ops - categorical run cadence on workflows + ai_interventions
-- Run AFTER intervention_per_use_migration.sql. Safe to re-run.
--
-- Adds a `frequency_cadence` text column to both tables, alongside the
-- existing numeric `frequency_per_week` / `uses_per_week`. The numeric
-- columns stay authoritative for dashboard math; on every write the
-- action layer (or the log_/update_intervention RPC) derives the numeric
-- value from the cadence so the two stay consistent. Lookup table
-- the action and SQL halves agree on:
--
--   daily        -> 7
--   weekly       -> 1
--   fortnightly  -> 0.5
--   monthly      -> 12/52  (≈ 0.231)
--
-- Backfill below bucketises existing numeric values so cadence is set
-- for every row. We deliberately leave the numeric column untouched so
-- pre-migration dashboards don't shift overnight - users canonicalise
-- on next edit by picking a cadence in the UI.
-- =========================================================================

-- 1. Workflows column + check ---------------------------------------------
alter table public.workflows
  add column if not exists frequency_cadence text;

alter table public.workflows
  drop constraint if exists workflows_frequency_cadence_check;
alter table public.workflows
  add  constraint workflows_frequency_cadence_check
       check (frequency_cadence is null
              or frequency_cadence in ('daily','weekly','fortnightly','monthly'));

-- 2. AI initiatives column + check ----------------------------------------
alter table public.ai_interventions
  add column if not exists frequency_cadence text;

alter table public.ai_interventions
  drop constraint if exists ai_interventions_frequency_cadence_check;
alter table public.ai_interventions
  add  constraint ai_interventions_frequency_cadence_check
       check (frequency_cadence is null
              or frequency_cadence in ('daily','weekly','fortnightly','monthly'));

-- 3. Backfill existing rows -----------------------------------------------
-- Bucket the legacy numeric value into the nearest cadence. Asymmetric
-- bands mirror lib/frequency.ts:perWeekToCadence so the SQL backfill and
-- in-app display agree. Leave cadence NULL for zero/null frequencies so
-- the UI shows a dash rather than guessing "monthly".
update public.workflows
   set frequency_cadence = case
     when frequency_per_week is null or frequency_per_week <= 0 then null
     when frequency_per_week >= 4    then 'daily'
     when frequency_per_week > 0.75  then 'weekly'
     when frequency_per_week > 0.35  then 'fortnightly'
     else                                'monthly'
   end
 where frequency_cadence is null;

update public.ai_interventions
   set frequency_cadence = case
     when uses_per_week is null or uses_per_week <= 0 then null
     when uses_per_week >= 4    then 'daily'
     when uses_per_week > 0.75  then 'weekly'
     when uses_per_week > 0.35  then 'fortnightly'
     else                            'monthly'
   end
 where frequency_cadence is null;

-- 4. Rebuild log_intervention with the cadence parameter ------------------
-- Adds p_frequency_cadence (text, optional). When supplied, the RPC also
-- writes ai_interventions.frequency_cadence. The numeric p_uses_per_week
-- still drives the math; the client passes the cadence-derived number so
-- the two stay in sync.
drop function if exists public.log_intervention(
  text, text[], uuid[],
  numeric, numeric, numeric, numeric,
  text, text, text, smallint, text[], text[]
);

create or replace function public.log_intervention(
  p_name text,
  p_types text[],
  p_workflow_ids uuid[],
  p_uses_per_week numeric,
  p_minutes_saved_per_use numeric,
  p_cost_saved_per_use numeric,
  p_revenue_per_use numeric,
  p_description text default null,
  p_attribution_confidence text default 'medium',
  p_adoption_status text default null,
  p_satisfaction    smallint default null,
  p_recipient_emails text[] default '{}',
  p_tools_used      text[] default '{}',
  p_frequency_cadence text default null
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
  v_tools           text[];
  v_types           text[];
  v_uses            numeric := coalesce(p_uses_per_week, 0);
  v_min_per_use     numeric := coalesce(p_minutes_saved_per_use, 0);
  v_cost_per_use    numeric := coalesce(p_cost_saved_per_use, 0);
  v_rev_per_use     numeric := coalesce(p_revenue_per_use, 0);
  v_cadence         text    := nullif(p_frequency_cadence, '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_workflow_ids is null or array_length(p_workflow_ids, 1) is null then
    raise exception 'At least one workflow is required' using errcode = '22023';
  end if;

  if p_types is null or array_length(p_types, 1) is null then
    raise exception 'At least one type is required' using errcode = '22023';
  end if;

  if p_uses_per_week is null or p_uses_per_week < 0 then
    raise exception 'Times per week is required and must be >= 0' using errcode = '22023';
  end if;

  if v_cadence is not null
     and v_cadence not in ('daily','weekly','fortnightly','monthly') then
    raise exception 'Invalid frequency_cadence: %', v_cadence using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct t), '{}')
    into v_types
    from unnest(p_types) as t
   where t in ('tool','training','prompt','agent','automation','process_change');

  if array_length(v_types, 1) is null then
    raise exception 'No valid intervention types in %', p_types using errcode = '22023';
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

  if p_tools_used is null then
    v_tools := '{}';
  else
    select coalesce(array_agg(distinct trim(t)), '{}')
      into v_tools
      from unnest(p_tools_used) as t
     where t is not null
       and length(trim(t)) > 0;
  end if;

  v_owner := auth.jwt() ->> 'email';

  insert into public.ai_interventions
        (name, types, description, status, owner,
         uses_per_week, minutes_saved_per_use,
         cost_saved_per_use, revenue_per_use,
         minutes_saved_per_week,
         estimated_gbp_saved_per_week, estimated_revenue_per_week,
         attribution_confidence,
         adoption_status, satisfaction,
         recipient_emails, tools_used,
         frequency_cadence,
         created_by)
  values (p_name, v_types, p_description, 'active', v_owner,
          v_uses, v_min_per_use,
          v_cost_per_use, v_rev_per_use,
          v_min_per_use * v_uses,
          v_cost_per_use * v_uses, v_rev_per_use * v_uses,
          p_attribution_confidence,
          p_adoption_status, p_satisfaction,
          v_recipients, v_tools,
          v_cadence,
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
  text, text[], uuid[],
  numeric, numeric, numeric, numeric,
  text, text, text, smallint, text[], text[], text
) to authenticated;

-- 5. Rebuild update_intervention with the cadence parameter ---------------
drop function if exists public.update_intervention(
  uuid, text, text[], text,
  numeric, numeric, numeric, numeric,
  text, text, smallint
);

create or replace function public.update_intervention(
  p_id uuid,
  p_name text,
  p_types text[],
  p_description text,
  p_uses_per_week numeric,
  p_minutes_saved_per_use numeric,
  p_cost_saved_per_use numeric,
  p_revenue_per_use numeric,
  p_attribution_confidence text,
  p_adoption_status text default null,
  p_satisfaction    smallint default null,
  p_frequency_cadence text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email   text := auth.jwt() ->> 'email';
  v_old     public.ai_interventions%rowtype;
  v_types   text[];
  v_uses    numeric := coalesce(p_uses_per_week, 0);
  v_min_pu  numeric := coalesce(p_minutes_saved_per_use, 0);
  v_cost_pu numeric := coalesce(p_cost_saved_per_use, 0);
  v_rev_pu  numeric := coalesce(p_revenue_per_use, 0);
  v_cadence text    := nullif(p_frequency_cadence, '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.can_edit_intervention(p_id) then
    raise exception 'Not allowed to edit this intervention' using errcode = '42501';
  end if;

  if length(coalesce(p_name, '')) = 0 then
    raise exception 'Name is required' using errcode = '22023';
  end if;

  if p_types is null or array_length(p_types, 1) is null then
    raise exception 'At least one type is required' using errcode = '22023';
  end if;

  if p_uses_per_week is null or p_uses_per_week < 0 then
    raise exception 'Times per week is required and must be >= 0' using errcode = '22023';
  end if;

  if v_cadence is not null
     and v_cadence not in ('daily','weekly','fortnightly','monthly') then
    raise exception 'Invalid frequency_cadence: %', v_cadence using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct t), '{}')
    into v_types
    from unnest(p_types) as t
   where t in ('tool','training','prompt','agent','automation','process_change');

  if array_length(v_types, 1) is null then
    raise exception 'No valid intervention types in %', p_types using errcode = '22023';
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

  select * into v_old from public.ai_interventions where id = p_id;
  if not found then
    raise exception 'Intervention not found' using errcode = 'P0002';
  end if;

  if v_old.name is distinct from p_name then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'name', v_old.name, p_name);
  end if;

  if v_old.types is distinct from v_types then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'types',
            array_to_string(v_old.types, ', '),
            array_to_string(v_types, ', '));
  end if;

  if v_old.description is distinct from p_description then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'description', v_old.description, p_description);
  end if;

  if v_old.uses_per_week is distinct from v_uses then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'uses_per_week',
            v_old.uses_per_week::text, v_uses::text);
  end if;
  if v_old.minutes_saved_per_use is distinct from v_min_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'minutes_saved_per_use',
            v_old.minutes_saved_per_use::text, v_min_pu::text);
  end if;
  if v_old.cost_saved_per_use is distinct from v_cost_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'cost_saved_per_use',
            v_old.cost_saved_per_use::text, v_cost_pu::text);
  end if;
  if v_old.revenue_per_use is distinct from v_rev_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'revenue_per_use',
            v_old.revenue_per_use::text, v_rev_pu::text);
  end if;

  if v_old.frequency_cadence is distinct from v_cadence then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'frequency_cadence',
            v_old.frequency_cadence, v_cadence);
  end if;

  if v_old.attribution_confidence is distinct from p_attribution_confidence then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'attribution_confidence',
            v_old.attribution_confidence, p_attribution_confidence);
  end if;

  if v_old.adoption_status is distinct from p_adoption_status then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'adoption_status',
            v_old.adoption_status, p_adoption_status);
  end if;

  if v_old.satisfaction is distinct from p_satisfaction then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'satisfaction',
            v_old.satisfaction::text, p_satisfaction::text);
  end if;

  update public.ai_interventions
     set name                         = p_name,
         types                        = v_types,
         description                  = p_description,
         uses_per_week                = v_uses,
         minutes_saved_per_use        = v_min_pu,
         cost_saved_per_use           = v_cost_pu,
         revenue_per_use              = v_rev_pu,
         minutes_saved_per_week       = v_min_pu * v_uses,
         estimated_gbp_saved_per_week = v_cost_pu * v_uses,
         estimated_revenue_per_week   = v_rev_pu * v_uses,
         attribution_confidence       = p_attribution_confidence,
         adoption_status              = p_adoption_status,
         satisfaction                 = p_satisfaction,
         frequency_cadence            = v_cadence
   where id = p_id;
end;
$$;

grant execute on function public.update_intervention(
  uuid, text, text[], text,
  numeric, numeric, numeric, numeric,
  text, text, smallint, text
) to authenticated;

notify pgrst, 'reload schema';
