-- =========================================================================
-- Phlo AI Ops - add `in_progress` to suggestion status enum
--
-- Drag-drop on the roadmap should let a super-admin promote a card to the
-- "In progress" lane without first having to log an intervention. The
-- previous lane derivation required `intervention_id IS NOT NULL`, which
-- created a chicken-and-egg dance: the card couldn't move until the work
-- was already shipped.
--
-- New lane semantics:
--   Up next     = status `accepted`
--   In progress = status `in_progress`
--   Shipped     = status `shipped`
--
-- Run after intervention_suggestions_migration.sql. Safe to re-run.
-- =========================================================================

alter table public.intervention_suggestions
  drop constraint if exists intervention_suggestions_status_check;

alter table public.intervention_suggestions
  add constraint intervention_suggestions_status_check
  check (status in (
    'open','under_review','accepted','in_progress','declined','shipped'
  ));

notify pgrst, 'reload schema';
