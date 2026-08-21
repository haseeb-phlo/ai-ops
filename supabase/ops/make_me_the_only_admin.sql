-- Make one person the only super admin.
--
-- Run this in the Supabase SQL editor (it runs as `postgres`, so the
-- role_grants_integrity trigger lets the role change through). It is NOT a
-- migration: who holds a role is data, not schema, and a migration would
-- replay it on every environment.
--
-- Nobody is deleted and nothing is revoked beyond the role. Demoted people
-- keep their account, their history and their profile - they just stop
-- seeing /admin, /learn/admin and view-as.

-- ---------------------------------------------------------------- step 1
-- Who is a super admin right now? Read this before running step 2.
select u.email, g.role, g.team, g.created_at
  from public.role_grants g
  join auth.users u on u.id = g.user_id
 where g.role = 'super_admin'
 order by u.email;

-- ---------------------------------------------------------------- step 2
-- The change itself. One transaction, and it refuses to run if your email
-- does not resolve to an account - otherwise a typo demotes every admin
-- and promotes nobody, which locks the whole org out of /admin.
begin;

do $$
declare
  v_me constant text := 'haseeb.hamid@wearephlo.com';  -- change if not you
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_me);
  if v_id is null then
    raise exception 'No account for %. Nothing changed.', v_me;
  end if;

  insert into public.role_grants (user_id, role)
  values (v_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin';

  update public.role_grants
     set role = 'member'
   where role = 'super_admin'
     and user_id <> v_id;
end $$;

-- ---------------------------------------------------------------- step 3
-- Confirm before committing: exactly one row, and it is you.
select u.email, g.role
  from public.role_grants g
  join auth.users u on u.id = g.user_id
 where g.role = 'super_admin';

commit;
