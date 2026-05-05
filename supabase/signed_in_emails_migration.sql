-- =========================================================================
-- Phlo AI Ops - signed-in email lookup
--
-- Adds a security-definer RPC that returns lower-cased emails of auth.users
-- who have signed in at least once (last_sign_in_at IS NOT NULL). Used by
-- the directory view to dim un-signed-in people.
--
-- These emails are already visible in public.people; this RPC just exposes
-- the "have they actually signed in yet" bit. Authenticated users only.
--
-- Safe to re-run.
-- =========================================================================

create or replace function public.signed_in_emails()
returns text[]
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result text[];
begin
  select coalesce(array_agg(lower(email)), '{}'::text[])
    into result
    from auth.users
   where email is not null
     and last_sign_in_at is not null;
  return result;
end;
$$;

revoke all on function public.signed_in_emails() from public;
grant execute on function public.signed_in_emails() to authenticated;

notify pgrst, 'reload schema';
