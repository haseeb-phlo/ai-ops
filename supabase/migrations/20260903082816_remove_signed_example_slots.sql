-- The five "Example N" submission slots come off live tracks.
--
-- They were removed from lib/programme/track-spec.ts, but the generated seed
-- only ever INSERTS and syncs title/description - it has no delete - so a
-- track that already exists keeps every slot it was seeded with. Cohorts 1A
-- and 1B were mid-week 1 when the spec changed, so without this they carry
-- five slots that exist nowhere in the code: nothing explains them, nothing
-- needs them, and RAG counts each one as an unlocked item going late.
--
-- One of them is worse than untidy. Day 3's "Example 1" is a WEEK ONE
-- submission slot, and unlock rule 2b (lib/programme/unlock.ts) locks every
-- item past week 1 until all of them are in. So on the Monday week 2 opens,
-- a member who has not submitted an Example 1 - and none of the 31 members
-- across both cohorts has - would have found week 2 shut behind a slot the
-- programme no longer asks for. That is the deadline this migration is
-- written against.
--
-- WHAT HAPPENS TO WHAT POINTS AT THEM, since the constraints differ and only
-- one of them is lossy:
--
--   - programme_submissions.track_item_id is ON DELETE SET NULL, so any
--     submission SURVIVES with a null item. That is what makes this safe to
--     run anywhere: every G3 counter filters on `kind`, never on the item
--     (track-data.ts, cohort-admin.ts, complete-action.ts), so an approved
--     example still pays its credit afterwards, and the lead queue already
--     renders a null item as "Submission" rather than dropping the row.
--   - programme_item_progress.track_item_id is ON DELETE CASCADE, so the
--     "this slot is done" rows go with the slot. Nothing reads them once the
--     item is gone.
--
-- On this project both are moot: at the time of writing all five slots have
-- zero submissions and zero progress rows. The behaviour is documented
-- because it is what makes the migration safe to run against a project where
-- that is not true.
--
-- Written declaratively - "the core programme has no signed_example slots" -
-- rather than by naming five ids, so it is idempotent and does not care
-- whether the seed has run yet. The kind is read from config_json rather than
-- the title because the title is seed-owned and has been reworded before
-- ("Signed example N" became "Example N"); the kind never has.
--
-- `signed_example` itself stays in the programme_submissions CHECK
-- constraint. Dropping it would be a second, genuinely destructive change,
-- and the rows it protects are the whole reason G3 still counts them.

delete from public.programme_track_items i
 where i.track_id = (
         select id from public.programme_tracks where slug = 'core-programme'
       )
   and i.type = 'submission_slot'
   and i.config_json->>'kind' = 'signed_example';
