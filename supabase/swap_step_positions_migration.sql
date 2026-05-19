-- =========================================================================
-- Phlo AI Ops - atomic step-position swap
--
-- workflows/[id]/actions.ts:moveStep originally did two sequential updates
-- to swap positions on two rows. There's no unique constraint on
-- (workflow_id, position), so a partial failure (network blip, crash
-- between the two writes) left both steps sharing a position, and any
-- later moveStep call became non-deterministic.
--
-- This function performs the swap as a single statement from the caller's
-- perspective. Postgres treats the function call atomically: if any
-- statement inside it fails, the entire call is rolled back, so the two
-- rows can never end up with duplicate positions.
--
-- security invoker - RLS on workflow_steps still applies, so a user can
-- only swap steps they would already be allowed to update.
--
-- Safe to re-run.
-- =========================================================================

create or replace function public.swap_step_positions(
  p_step_a uuid,
  p_step_b uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a_pos integer;
  b_pos integer;
  a_workflow uuid;
  b_workflow uuid;
begin
  select position, workflow_id
    into a_pos, a_workflow
    from public.workflow_steps
   where id = p_step_a;
  select position, workflow_id
    into b_pos, b_workflow
    from public.workflow_steps
   where id = p_step_b;

  if a_pos is null or b_pos is null then
    raise exception 'swap_step_positions: step not found';
  end if;
  if a_workflow is null
     or b_workflow is null
     or a_workflow <> b_workflow then
    raise exception 'swap_step_positions: steps belong to different workflows';
  end if;

  update public.workflow_steps set position = b_pos where id = p_step_a;
  update public.workflow_steps set position = a_pos where id = p_step_b;
end;
$$;

revoke all on function public.swap_step_positions(uuid, uuid) from public;
grant execute on function public.swap_step_positions(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
