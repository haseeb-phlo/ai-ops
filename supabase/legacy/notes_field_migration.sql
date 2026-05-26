-- =========================================================================
-- Notes field on workflows + ai_interventions
-- =========================================================================
-- Adds a single freeform "notes" column to each entity so submitters can
-- capture context the structured fields don't cover (caveats, links,
-- background reasoning). Plain text, capped at 2000 chars by the action
-- layer; nullable so existing rows aren't disturbed.
--
-- Audit:
--   * workflows.notes edits flow through workflow_revisions (one row per
--     change, written by the updateWorkflow Server Action).
--   * ai_interventions.notes edits go through intervention_edits, written
--     directly by the updateIntervention Server Action (same pattern as
--     status/recipients, which aren't audited by update_intervention RPC
--     yet).
--
-- Safe to re-run.
-- =========================================================================

alter table public.workflows
  add column if not exists notes text;

alter table public.ai_interventions
  add column if not exists notes text;

notify pgrst, 'reload schema';
