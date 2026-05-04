-- =========================================================================
-- Phlo AI Ops — interventions migration (additive)
-- Run in Supabase Studio → SQL Editor AFTER schema.sql, workflows.sql,
-- workflows_migration.sql. Safe to re-run.
-- =========================================================================

-- 1. Extend ai_interventions with the columns the UI needs ----------------
alter table public.ai_interventions
  add column if not exists type        text,
  add column if not exists owner       text,
  add column if not exists minutes_saved_per_week numeric,
  add column if not exists created_by  uuid references auth.users(id);

alter table public.ai_interventions
  alter column status set default 'active';

-- Constrain type + status (drop-and-readd so it's idempotent).
alter table public.ai_interventions
  drop constraint if exists ai_interventions_type_check;
alter table public.ai_interventions
  add  constraint ai_interventions_type_check
       check (type is null or type in
              ('tool','training','prompt','agent','automation','process_change'));

alter table public.ai_interventions
  drop constraint if exists ai_interventions_status_check;
alter table public.ai_interventions
  add  constraint ai_interventions_status_check
       check (status is null or status in ('active','paused','retired'));

create index if not exists ai_interventions_type_idx   on public.ai_interventions(type);
create index if not exists ai_interventions_status_idx on public.ai_interventions(status);
create index if not exists ai_interventions_created_idx on public.ai_interventions(created_at desc);

-- 2. workflow_baselines: per-(workflow, intervention) metric snapshot taken
--    at the moment an intervention is logged. Lets us measure deltas later.
create table if not exists public.workflow_baselines (
  id              uuid primary key default gen_random_uuid(),
  workflow_id     uuid not null references public.workflows(id)        on delete cascade,
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  time_value      numeric,
  cost_value      numeric,
  people_value    numeric,
  errors_value    numeric,
  revenue_value   numeric,
  captured_at     timestamptz not null default now(),
  unique (workflow_id, intervention_id)
);

create index if not exists workflow_baselines_intervention_idx
  on public.workflow_baselines(intervention_id);

-- 3. intervention_metrics: timeline of post-intervention measurements ------
create table if not exists public.intervention_metrics (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  snapshot_date   date not null default current_date,
  time_value      numeric,
  cost_value      numeric,
  people_value    numeric,
  errors_value    numeric,
  revenue_value   numeric,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists intervention_metrics_intervention_idx
  on public.intervention_metrics(intervention_id, snapshot_date desc);

-- 4. Row-level security ---------------------------------------------------
alter table public.workflow_baselines   enable row level security;
alter table public.intervention_metrics enable row level security;

-- Read: any signed-in user.
drop policy if exists "auth read workflow_baselines"   on public.workflow_baselines;
drop policy if exists "auth read intervention_metrics" on public.intervention_metrics;
create policy "auth read workflow_baselines"
  on public.workflow_baselines   for select to authenticated using (true);
create policy "auth read intervention_metrics"
  on public.intervention_metrics for select to authenticated using (true);

-- Insert: any signed-in user (the RPC writes these on the user's behalf).
drop policy if exists "auth insert ai_interventions"       on public.ai_interventions;
drop policy if exists "auth insert intervention_workflows" on public.intervention_workflows;
drop policy if exists "auth insert workflow_baselines"     on public.workflow_baselines;
drop policy if exists "auth insert intervention_metrics"   on public.intervention_metrics;

create policy "auth insert ai_interventions"
  on public.ai_interventions       for insert to authenticated with check (true);
create policy "auth insert intervention_workflows"
  on public.intervention_workflows for insert to authenticated with check (true);
create policy "auth insert workflow_baselines"
  on public.workflow_baselines     for insert to authenticated with check (true);
create policy "auth insert intervention_metrics"
  on public.intervention_metrics   for insert to authenticated with check (true);

-- 5. log_intervention RPC -------------------------------------------------
-- Atomic: in one transaction it (a) inserts the intervention,
-- (b) inserts the join rows, (c) snapshots workflow_baselines from the
-- most recent workflow_metrics (zeros if none), (d) writes today's
-- initial intervention_metrics row. Returns the new intervention id.
create or replace function public.log_intervention(
  p_name text,
  p_type text,
  p_workflow_ids uuid[],
  p_description text default null,
  p_minutes_saved_per_week numeric default null
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

  -- Owner name = the signed-in user's email (best effort).
  select email into v_owner from auth.users where id = v_user_id;

  -- (a) insert the intervention row.
  insert into public.ai_interventions
        (name, type, description, status, owner, minutes_saved_per_week, created_by)
  values (p_name, p_type, p_description, 'active', v_owner,
          p_minutes_saved_per_week, v_user_id)
  returning id into v_intervention_id;

  -- (b) + (c): join rows + baseline snapshot per linked workflow.
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

  -- (d) initial intervention_metrics row for today (nulls = not measured yet).
  insert into public.intervention_metrics
        (intervention_id, snapshot_date, created_by)
  values (v_intervention_id, current_date, v_user_id);

  return v_intervention_id;
end;
$$;

grant execute on function public.log_intervention(text, text, uuid[], text, numeric)
  to authenticated;
