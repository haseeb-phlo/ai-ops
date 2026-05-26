-- =========================================================================
-- Phlo AI Ops - champion management plumbing
--
-- Adds a security-definer RPC that lets super-admins resolve a person's
-- auth.users.id from their email. Needed by the manage-champions admin UI:
-- the form picks a person from public.people (which has email + name) and
-- we want to populate champions.user_id whenever that email already maps
-- to a signed-in auth user. People who haven't signed in yet still get a
-- champion record (user_id stays null until they sign in).
--
-- Run AFTER champions_visibility_migration.sql. Safe to re-run.
-- =========================================================================

create or replace function public.user_id_for_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
  result uuid;
begin
  select role into caller_role
    from public.role_grants
   where user_id = auth.uid();

  if caller_role is distinct from 'super_admin' then
    raise exception 'Only super_admin may resolve user emails'
      using errcode = '42501';
  end if;

  select id into result
    from auth.users
   where lower(email) = lower(p_email)
   limit 1;

  return result;
end;
$$;

revoke all on function public.user_id_for_email(text) from public;
grant execute on function public.user_id_for_email(text) to authenticated;

notify pgrst, 'reload schema';
