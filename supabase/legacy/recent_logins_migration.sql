-- =========================================================================
-- Phlo AI Ops - recent_logins admin RPC
--
-- Surfaces (email, last_sign_in_at) per user from auth.users so the admin
-- panel can show sign-in cadence until proper analytics are wired up.
--
-- Super-admin only at the database layer because it crosses into
-- auth.users; the security-definer function gates on a role_grants check
-- so a leaked grant on the function alone wouldn't expose the data.
--
-- Safe to re-run.
-- =========================================================================

create or replace function public.recent_logins()
returns table (
  email           text,
  last_sign_in_at timestamptz,
  created_at      timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.role_grants
      where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Super-admin only' using errcode = '42501';
  end if;

  return query
    select lower(u.email) as email,
           u.last_sign_in_at,
           u.created_at
      from auth.users u
     where u.email is not null
     order by u.last_sign_in_at desc nulls last;
end;
$$;

revoke all on function public.recent_logins() from public;
grant execute on function public.recent_logins() to authenticated;

notify pgrst, 'reload schema';
