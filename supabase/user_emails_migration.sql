-- =========================================================================
-- Phlo AI Ops - user-id → email lookup (scoped)
--
-- Returns (user_id, email) tuples for the user_ids passed in. Used by
-- surfaces that need to resolve a created_by uuid to an email so we can
-- bridge auth.users → public.people by canonical email (and from there to
-- avatars / display names) when the user's customised profile.display_name
-- has drifted from the seed people.display_name.
--
-- An earlier version of this RPC took no arguments and dumped every
-- signed-in user's email in one call - any authenticated user could
-- enumerate the whole directory in a single round-trip. This version
-- requires the caller to supply specific user_ids (which they must
-- already have from RLS-protected reads), capped at 500 per call.
--
-- Authenticated users only. Safe to re-run.
-- =========================================================================

-- Drop the legacy no-arg version if it still exists. Function signatures
-- are identified by argument types, so the no-arg version and the
-- (uuid[]) version coexist independently until we explicitly remove it.
drop function if exists public.user_emails();

create or replace function public.user_emails(p_user_ids uuid[])
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return;
  end if;
  if array_length(p_user_ids, 1) > 500 then
    raise exception 'user_emails: too many user_ids (max 500)';
  end if;
  return query
    select u.id as user_id, lower(u.email) as email
      from auth.users u
     where u.id = any(p_user_ids)
       and u.email is not null;
end;
$$;

revoke all on function public.user_emails(uuid[]) from public;
grant execute on function public.user_emails(uuid[]) to authenticated;

notify pgrst, 'reload schema';
