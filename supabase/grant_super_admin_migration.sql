-- =========================================================================
-- Phlo AI Ops - grant super_admin
-- Run in Supabase Studio - SQL Editor. Safe to re-run.
-- Requires admin_migration.sql to have been applied first (so the
-- role_grants_role_check constraint includes 'super_admin').
-- =========================================================================

update public.role_grants
   set role = 'super_admin'
 where user_id = (
   select id from auth.users
    where email = 'haseeb.hamid@wearephlo.com'
    limit 1
 );
