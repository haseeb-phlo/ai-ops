-- =========================================================================
-- Phlo AI Ops - intervention edit + retire migration (additive)
-- Adds:
--   * intervention_edits audit table
--   * can_edit_intervention() permission helper
--   * update_intervention() RPC (per-field audit row)
--   * set_intervention_status() RPC (soft-delete via 'retired')
--   * RLS update policy on ai_interventions
-- Run AFTER all earlier migrations. Safe to re-run.
-- =========================================================================

-- 1. Audit table -----------------------------------------------------------
create table if not exists public.intervention_edits (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  actor_email     text,
  action          text not null check (action in ('edit', 'status_change')),
  field           text,
  old_value       text,
  new_value       text,
  created_at      timestamptz not null default now()
);

create index if not exists intervention_edits_intervention_idx
  on public.intervention_edits (intervention_id, created_at desc);

alter table public.intervention_edits enable row level security;

drop policy if exists "auth read intervention_edits"   on public.intervention_edits;
drop policy if exists "auth insert intervention_edits" on public.intervention_edits;

create policy "auth read intervention_edits"
  on public.intervention_edits for select to authenticated using (true);

create policy "auth insert intervention_edits"
  on public.intervention_edits for insert to authenticated with check (true);

grant select, insert on public.intervention_edits to authenticated;

-- 2. Permission helper -----------------------------------------------------
-- Returns true if the current auth user can edit/retire the intervention:
--   * super_admin role, or
--   * created_by = auth.uid() (the champion who logged it), or
--   * a champion for any team that owns one of the linked workflows.
create or replace function public.can_edit_intervention(p_intervention_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.ai_interventions i
      where i.id = p_intervention_id and i.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.intervention_workflows iw
      join public.workflows w on w.id = iw.workflow_id
      join public.champions c  on c.team = w.team
      where iw.intervention_id = p_intervention_id
        and c.user_id = auth.uid()
    );
$$;

grant execute on function public.can_edit_intervention(uuid) to authenticated;

-- 3. RLS: restricted update on ai_interventions ----------------------------
-- Defense in depth - even if someone bypasses the RPC and crafts a direct
-- UPDATE, RLS rejects it unless can_edit_intervention is true.
drop policy if exists "edit ai_interventions" on public.ai_interventions;
create policy "edit ai_interventions"
  on public.ai_interventions for update to authenticated
  using      (public.can_edit_intervention(id))
  with check (public.can_edit_intervention(id));

-- 4. update_intervention RPC ----------------------------------------------
-- Atomically updates the editable fields and writes one intervention_edits
-- row per changed field. Raises if the caller is not allowed.
create or replace function public.update_intervention(
  p_id uuid,
  p_name text,
  p_type text,
  p_description text,
  p_minutes_saved_per_week numeric,
  p_attribution_confidence text
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

  if p_type not in ('tool','training','prompt','agent','automation','process_change') then
    raise exception 'Invalid intervention type: %', p_type using errcode = '22023';
  end if;

  if p_attribution_confidence not in ('high','medium','low') then
    raise exception 'Invalid attribution_confidence: %', p_attribution_confidence
      using errcode = '22023';
  end if;

  select * into v_old from public.ai_interventions where id = p_id;
  if not found then
    raise exception 'Intervention not found' using errcode = 'P0002';
  end if;

  -- One audit row per changed field. `is distinct from` treats NULLs sanely.
  if v_old.name is distinct from p_name then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'edit', 'name', v_old.name, p_name);
  end if;

  if v_old.type is distinct from p_type then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'edit', 'type', v_old.type, p_type);
  end if;

  if v_old.description is distinct from p_description then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'edit', 'description', v_old.description, p_description);
  end if;

  if v_old.minutes_saved_per_week is distinct from p_minutes_saved_per_week then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'edit', 'minutes_saved_per_week',
       v_old.minutes_saved_per_week::text, p_minutes_saved_per_week::text);
  end if;

  if v_old.attribution_confidence is distinct from p_attribution_confidence then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'edit', 'attribution_confidence',
       v_old.attribution_confidence, p_attribution_confidence);
  end if;

  update public.ai_interventions
     set name                   = p_name,
         type                   = p_type,
         description            = p_description,
         minutes_saved_per_week = p_minutes_saved_per_week,
         attribution_confidence = p_attribution_confidence
   where id = p_id;
end;
$$;

grant execute on function public.update_intervention(uuid, text, text, text, numeric, text)
  to authenticated;

-- 5. set_intervention_status RPC -------------------------------------------
-- Soft-delete: flip between 'active' / 'paused' / 'retired'. We never hard
-- delete because workflow_baselines and intervention_metrics cascade - past
-- dashboards already counted that row, so erasing it would rewrite history.
create or replace function public.set_intervention_status(
  p_id     uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email   text := auth.jwt() ->> 'email';
  v_old     text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.can_edit_intervention(p_id) then
    raise exception 'Not allowed to edit this intervention' using errcode = '42501';
  end if;

  if p_status not in ('active','paused','retired') then
    raise exception 'Invalid status: %', p_status using errcode = '22023';
  end if;

  select status into v_old from public.ai_interventions where id = p_id;
  if not found then
    raise exception 'Intervention not found' using errcode = 'P0002';
  end if;

  if v_old is distinct from p_status then
    update public.ai_interventions set status = p_status where id = p_id;

    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'status_change', 'status', v_old, p_status);
  end if;
end;
$$;

grant execute on function public.set_intervention_status(uuid, text) to authenticated;

-- 6. Refresh PostgREST schema cache so the new RPCs are callable immediately.
notify pgrst, 'reload schema';
