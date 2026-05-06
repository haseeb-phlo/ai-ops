-- =========================================================================
-- Phlo AI Ops - user-id → email lookup
--
-- Adds a security-definer RPC that returns (user_id, email) tuples for every
-- auth.users row with an email. Used by the People map to match a profile
-- (which only carries user_id + display_name) back to its public.people row
-- by canonical email when the customised display_name no longer matches.
--
-- Without this, anyone whose profile.display_name diverges from the seed
-- people.display_name floats orphaned on the galaxy because peopleByName
-- can't resolve a team.
--
-- Authenticated users only. Safe to re-run.
-- =========================================================================

create or replace function public.user_emails()
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select u.id as user_id, lower(u.email) as email
      from auth.users u
     where u.email is not null;
end;
$$;

revoke all on function public.user_emails() from public;
grant execute on function public.user_emails() to authenticated;

notify pgrst, 'reload schema';
