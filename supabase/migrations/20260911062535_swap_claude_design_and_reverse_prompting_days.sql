-- Days 10 and 12 of the Core Programme swapped: Claude Design comes forward to
-- day 10 and Reverse Prompting goes back to day 12.
--
-- The topic list and the two tasks are a code change (lib/programme/track-spec.ts)
-- and the three quiz questions are another (lib/programme/quiz-content.ts).
-- Re-running the generated seed carries all of that onto a live track, because
-- the seed syncs each item's title, description and config_json. What the seed
-- cannot do is re-point learn_video_id: its re-bind block only fills nulls, so
-- that a binding an admin made by hand in the Track-items screen is never
-- overwritten. That rule is worth keeping and this migration does not change it.
--
-- Half of this swap the seed CAN do and half it cannot:
--
--   day 12  none              -> Reverse Prompting, which the seed fills,
--                                because day 12's binding is null today and
--                                its new title matches a learn_videos row
--   day 10  Reverse Prompting -> none, which the seed does NOT do, because
--                                Claude Design has never been recorded and the
--                                re-bind only fills nulls
--
-- So without this, day 10 keeps pointing at the Reverse Prompting recording
-- under a heading reading "Claude Design", and day 12 points at the same
-- recording legitimately - one video on two days, one of them lying about it.
-- This is the failure 20260909050428_swap_artifacts_and_cowork_days exists for,
-- and this file follows it in NULLING as well as SETTING. A member who pressed
-- play on day 10 would watch Reverse Prompting, a technique they are taught two
-- days later, under a title that looks right, with nothing on the page to tell
-- them. A day admitting it has no video beats a day lying about which one it
-- has.
--
-- WHY THIS DIRECTION IS SAFE TODAY. Day 10 opened for Cohorts 1A and 1B on
-- 2026-09-11 and no member of either had started it: every existing day 10 and
-- day 12 progress row belongs to the Rehearsal cohort, a test cohort that
-- finished in June. A swap renames items in place rather than moving rows, so a
-- live member who had already completed day 10 would have been left holding a
-- completion for a topic they never did. That was checked before this ran
-- rather than assumed.
--
-- THE COST IS A DAY WITHOUT A VIDEO, and it moves rather than appearing: day 12
-- had no recording and now day 10 has none. Claude Design has never been shot.
-- content-readiness.ts already excludes an unbound video day from gate G1 and
-- from the RAG sweep, so no member is marked down for a recording that does not
-- exist. When it is shot it must be titled "Claude Design" to bind here.
--
-- Written declaratively - "day N points at the video called T" - over all
-- fifteen days rather than as an exchange of two ids. So it is idempotent, it
-- does not care whether the seed has run yet or in which order, and it stays
-- correct if somebody has already fixed one of the two by hand. Days 1-9, 11
-- and 13-15 are listed and unchanged; they are here so the file states the
-- whole mapping rather than a diff.
--
-- Days 10, 11, 13, 14 and 15 resolve to null because those topics have no row
-- in learn_videos. For 11, 13, 14 and 15 that is the pre-existing "coming soon"
-- state, and for 10 it is the new and intended one.

update public.programme_track_items i
   set learn_video_id = (
         select v.id
           from public.learn_videos v
          where lower(v.title) = lower(m.topic)
          limit 1
       )
  from (values
    (1,  'What is AI and how does it work?'),
    (2,  'When to use AI and when not to'),
    (3,  'Prompting'),
    (4,  'Projects'),
    (5,  'Connectors & MCP'),
    (6,  'Skills'),
    (7,  'Scheduled Tasks'),
    (8,  'Artifacts'),
    (9,  'Cowork'),
    (10, 'Claude Design'),
    (11, 'Research, Memory & files out'),
    (12, 'Reverse Prompting'),
    (13, 'Dispatch + Plugins'),
    (14, 'Claude everywhere'),
    (15, 'Choosing the right tool + measuring time saved')
  ) as m(day_index, topic)
 where i.track_id = (
         select id from public.programme_tracks where slug = 'core-programme'
       )
   and i.type = 'video'
   and i.day_index = m.day_index
   and i.learn_video_id is distinct from (
         select v.id
           from public.learn_videos v
          where lower(v.title) = lower(m.topic)
          limit 1
       );
