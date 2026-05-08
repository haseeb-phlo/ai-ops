-- =========================================================================
-- Phlo AI Ops - delete_intervention RPC (super-admin only)
--
-- The detail page's "Delete permanently" button used to issue a direct
-- REST DELETE. That silently failed under live perms: the `authenticated`
-- role has no GRANT DELETE on public.ai_interventions, and even with the
-- earlier ai_interventions_delete_policy_migration applied PostgREST hid
-- DELETE from `allow` because the GRANT was missing too.
--
-- Routing the delete through a security-definer RPC sidesteps both layers
-- (matching how update_intervention / set_intervention_status / log_-
-- intervention work). The role check moves into the function, so the
-- super-admin gate is enforced at the DB regardless of any future RLS
-- changes.
--
-- Returns the deleted id, or NULL if the row didn't exist (so the action
-- can distinguish "deleted" from "id not found"). Caller is expected to
-- have already gated by role at the JS layer; the DB check is defence in
-- depth.
--
-- Cascading FKs on intervention_workflows / workflow_baselines /
-- intervention_metrics clean up dependents automatically. Suggestion
-- linkage is detached first so any "shipped" suggestion flips back to
-- open instead of dangling on a deleted intervention.
--
-- Safe to re-run.
-- =========================================================================

create or replace function public.delete_intervention(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_super boolean;
  v_deleted_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.role_grants g
    where g.user_id = v_user_id and g.role = 'super_admin'
  ) into v_is_super;

  if not v_is_super then
    raise exception 'Only super_admin can delete interventions'
      using errcode = '42501';
  end if;

  -- Detach suggestions before the cascade fires so a suggestion that
  -- pointed here flips back to open instead of being stuck on a deleted
  -- intervention.
  update public.intervention_suggestions
     set intervention_id = null,
         status = 'open'
   where intervention_id = p_id;

  delete from public.ai_interventions
   where id = p_id
   returning id into v_deleted_id;

  return v_deleted_id;
end;
$$;

revoke all on function public.delete_intervention(uuid) from public;
grant execute on function public.delete_intervention(uuid) to authenticated;

notify pgrst, 'reload schema';
