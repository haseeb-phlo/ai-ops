-- =========================================================================
-- Phlo AI Ops - grant super_admin to James MacIver and Jamie MacDonald
-- Run in Supabase Studio - SQL Editor. Safe to re-run.
--
-- Prerequisite: both users must exist in auth.users. If they have not yet
-- signed in (or been invited via Admin -> Invite), run this AFTER they have
-- accepted their magic-link and the on_auth_user_created trigger has
-- created their default role_grants row. Until then, the update is a no-op.
--
-- Verify with the final SELECT - it should return two rows, both with
-- role = 'super_admin'.
-- =========================================================================

update public.role_grants
   set role = 'super_admin'
 where user_id in (
   select id from auth.users
    where email in (
      'james.maciver@wearephlo.com',
      'jamie.macdonald@wearephlo.com'
    )
 );

select u.email, g.role
  from public.role_grants g
  join auth.users u on u.id = g.user_id
 where u.email in (
   'james.maciver@wearephlo.com',
   'jamie.macdonald@wearephlo.com'
 );
