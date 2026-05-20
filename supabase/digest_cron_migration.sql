-- =========================================================================
-- Phlo AI Ops - service_role grants for the fortnightly digest cron
--
-- The digest is a server-initiated job with no human session. It uses the
-- service_role key to read the data it needs to compose each recipient's
-- email. fix_permissions.sql only grants to `authenticated`; this migration
-- adds the matching read grants for `service_role` so the cron can:
--
--   - enumerate users (via the user_emails RPC)
--   - score the top wins for the period
--   - find suggestions that have unresolved votes
--   - pick out unwatched learn videos for each recipient
--
-- The grants here are READ-ONLY. The cron never writes.
--
-- Safe to re-run.
-- =========================================================================

grant usage on schema public to service_role;

grant select on public.ai_interventions               to service_role;
grant select on public.intervention_workflows         to service_role;
grant select on public.workflow_baselines             to service_role;
grant select on public.intervention_metrics           to service_role;
grant select on public.intervention_suggestions       to service_role;
grant select on public.intervention_suggestion_votes  to service_role;
grant select on public.workflows                      to service_role;
grant select on public.workflow_metrics               to service_role;
grant select on public.learn_videos                   to service_role;
grant select on public.learn_video_plays              to service_role;
grant select on public.profiles                       to service_role;
grant select on public.people                         to service_role;
grant select on public.role_grants                    to service_role;
grant select on public.ai_intervention_comments       to service_role;
grant select on public.intervention_suggestion_comments to service_role;
grant select on public.learn_video_comments           to service_role;
grant select on public.regulatory_events              to service_role;

-- Make future tables auto-grant SELECT to service_role too, so adding a
-- column or table doesn't silently break the cron.
alter default privileges in schema public
  grant select on tables to service_role;

-- The cron resolves user_id → email via the scoped user_emails RPC. The
-- function was originally granted to `authenticated` only (the only
-- legitimate caller at write time); the cron is a system caller so we
-- grant it explicitly here. SECURITY DEFINER on the function means we
-- aren't widening RLS - we're widening the caller list.
grant execute on function public.user_emails(uuid[]) to service_role;

notify pgrst, 'reload schema';
