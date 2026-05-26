-- =========================================================================
-- Phlo AI Ops - shipped_at on ai_interventions
-- Run AFTER interventions_migration.sql. Safe to re-run.
--
-- Splits "shipped" from "retired" on the roadmap. Until now, dragging an
-- initiative into the Shipped lane wrote status='retired', which the
-- dashboard treats as decommissioned (excluded from active metrics). The
-- intent of "shipped" is the opposite: the initiative is live and done.
--
-- We add a shipped_at timestamp so shipped-ness lives independently of
-- status. Lane membership:
--   shipped_at is not null  -> Shipped lane (status unchanged, stays active)
--   shipped_at is null and status='active'  -> In progress
--   shipped_at is null and status='paused'  -> Up next
-- "Retired" remains a real lifecycle state set explicitly via the status
-- button / edit dialog (initiative was decommissioned).
--
-- Backfill: every existing row at status='retired' is assumed to have been
-- retired via the roadmap drag (the dominant path). We promote them to
-- status='active' with shipped_at = created_at, which keeps them visible in
-- the Shipped lane and starts counting them in active dashboards. If any
-- row was genuinely retired-via-status-button, the user can flip it back
-- through the edit dialog.
-- =========================================================================

-- 1. Add the column ------------------------------------------------------
alter table public.ai_interventions
  add column if not exists shipped_at timestamptz;

create index if not exists ai_interventions_shipped_at_idx
  on public.ai_interventions(shipped_at)
  where shipped_at is not null;

-- 2. Backfill existing retired rows -------------------------------------
-- Promote retired -> active + shipped_at so the Shipped lane stays
-- populated and metrics resume counting them.
update public.ai_interventions
   set shipped_at = coalesce(created_at, now()),
       status     = 'active'
 where status = 'retired'
   and shipped_at is null;

notify pgrst, 'reload schema';
