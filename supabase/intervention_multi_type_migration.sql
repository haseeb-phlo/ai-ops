-- =========================================================================
-- Phlo AI Ops - allow an AI initiative to span multiple types
--
-- A single-select `type` forced people to pick the "closest" bucket when an
-- initiative was, e.g., a tool *and* a training session. Switch to a text[]
-- of types and let the log/edit dialogs multi-select.
--
-- Backfills the new column from the old one, drops the old column, and
-- rebuilds the log_intervention and update_intervention RPCs so they
-- accept p_types text[] in place of p_type text.
--
-- Run AFTER tools_used_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Add the new column and backfill from the old one --------------------
alter table public.ai_interventions
  add column if not exists types text[] not null default '{}';

-- Idempotent backfill: only fills rows whose types is still empty.
update public.ai_interventions
   set types = array[type]
 where type is not null
   and (types is null or array_length(types, 1) is null);

-- Every element must be one of the known values. Empty arrays are allowed
-- on the column level (legacy rows with a null `type` backfill to `{}`);
-- the log_intervention RPC enforces "at least one" at insert time.
alter table public.ai_interventions
  drop constraint if exists ai_interventions_types_check;
alter table public.ai_interventions
  add  constraint ai_interventions_types_check
       check (types <@ array['tool','training','prompt','agent','automation','process_change']::text[]);

-- GIN index for array containment / overlap filters used by the list page.
create index if not exists ai_interventions_types_gin
  on public.ai_interventions using gin (types);

-- 2. Drop the legacy single-value column ---------------------------------
drop index if exists public.ai_interventions_type_idx;
alter table public.ai_interventions
  drop constraint if exists ai_interventions_type_check;
alter table public.ai_interventions
  drop column if exists type;

-- 3. Rebuild log_intervention RPC ----------------------------------------
-- Drop the previous (12-arg) signature first.
drop function if exists public.log_intervention(
  text, text, uuid[], text, numeric, text, numeric, numeric, text, smallint, text[], text[]
);

create or replace function public.log_intervention(
  p_name text,
  p_types text[],
  p_workflow_ids uuid[],
  p_description text default null,
  p_minutes_saved_per_week numeric default null,
  p_attribution_confidence text default 'medium',
  p_estimated_gbp_saved_per_week numeric default null,
  p_estimated_revenue_per_week    numeric default null,
  p_adoption_status text default null,
  p_satisfaction    smallint default null,
  p_recipient_emails text[] default '{}',
  p_tools_used      text[] default '{}'
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

  -- Dedupe while preserving allowed values only.
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
         minutes_saved_per_week, attribution_confidence,
         estimated_gbp_saved_per_week, estimated_revenue_per_week,
         adoption_status, satisfaction,
         recipient_emails, tools_used,
         created_by)
  values (p_name, v_types, p_description, 'active', v_owner,
          p_minutes_saved_per_week, p_attribution_confidence,
          p_estimated_gbp_saved_per_week, p_estimated_revenue_per_week,
          p_adoption_status, p_satisfaction,
          v_recipients, v_tools,
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
  text, text[], uuid[], text, numeric, text, numeric, numeric, text, smallint, text[], text[]
) to authenticated;

-- 4. Rebuild update_intervention RPC -------------------------------------
-- Drop the previous (8-arg) signature first.
drop function if exists public.update_intervention(
  uuid, text, text, text, numeric, text, text, smallint
);

create or replace function public.update_intervention(
  p_id uuid,
  p_name text,
  p_types text[],
  p_description text,
  p_minutes_saved_per_week numeric,
  p_attribution_confidence text,
  p_adoption_status text default null,
  p_satisfaction    smallint default null
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

  -- Audit the array change as a comma-joined string so it slots into the
  -- existing text-based old_value / new_value columns. Same shape as
  -- recipient_emails edits.
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

  if v_old.minutes_saved_per_week is distinct from p_minutes_saved_per_week then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'minutes_saved_per_week',
            v_old.minutes_saved_per_week::text, p_minutes_saved_per_week::text);
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
     set name                   = p_name,
         types                  = v_types,
         description            = p_description,
         minutes_saved_per_week = p_minutes_saved_per_week,
         attribution_confidence = p_attribution_confidence,
         adoption_status        = p_adoption_status,
         satisfaction           = p_satisfaction
   where id = p_id;
end;
$$;

grant execute on function public.update_intervention(
  uuid, text, text[], text, numeric, text, text, smallint
) to authenticated;

notify pgrst, 'reload schema';
