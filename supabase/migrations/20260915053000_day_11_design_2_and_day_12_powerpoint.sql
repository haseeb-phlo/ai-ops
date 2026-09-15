-- Days 11 and 12 of the Core Programme are replaced: "Research, Memory & files
-- out" becomes "Claude Design 2" and "Reverse Prompting" becomes "Claude
-- PowerPoint".
--
-- The topic list and the two tasks are a code change (lib/programme/track-spec.ts)
-- and the three quiz questions are another (lib/programme/quiz-content.ts).
-- Re-running the generated seed carries all of that onto a live track, because
-- the seed syncs each item's title, description and config_json. What the seed
-- cannot do is re-point learn_video_id: its re-bind block only fills nulls, so
-- that a binding an admin made by hand in the Track-items screen is never
-- overwritten. That rule is worth keeping and this migration does not change it.
--
-- Half of this change the seed CAN do and half it cannot:
--
--   day 11  none              -> Claude Design 2, which the seed fills,
--                                because day 11's binding is null today and
--                                its new title matches a learn_videos row
--                                added the same morning
--   day 12  Reverse Prompting -> none, which the seed does NOT do, because
--                                Claude PowerPoint has not been recorded and
--                                the re-bind only fills nulls
--
-- So without this, day 12 keeps pointing at the Reverse Prompting recording
-- under a heading reading "Claude PowerPoint" - the failure
-- 20260909050428_swap_artifacts_and_cowork_days and
-- 20260911062535_swap_claude_design_and_reverse_prompting_days both exist for,
-- and this file follows them in NULLING as well as SETTING. A member who
-- pressed play would watch a technique the programme no longer teaches, under a
-- title that looks right, with nothing on the page to tell them. A day
-- admitting it has no video beats a day lying about which one it has.
--
-- WHAT WAS CHECKED FIRST, because a replacement renames items in place rather
-- than moving rows. Day 11 opened for Cohorts 1A and 1B on 2026-09-14 and ONE
-- MEMBER OF EACH had already completed its Task, on the Research topic, by that
-- afternoon. Both keep a completion for a day that now asks for something else,
-- and the link each filed points at a Research chat. Nothing re-locks, so
-- neither is asked to do it again; whether they should be is the programme
-- owner's call. Day 12 has no live progress at all - every day 12 row belongs to
-- the Rehearsal cohort, which finished in June - and day 11's video item has
-- none either, because it had no video to watch.
--
-- THE COST MOVES RATHER THAN APPEARING, as it did in September's other swaps:
-- day 11 had no recording and now has one, day 12 had one and now has none.
-- content-readiness.ts excludes an unbound video day from gate G1 and from the
-- RAG sweep, so no member is marked down for a recording that does not exist.
-- The net effect on the two live cohorts is one new five-minute watch on day 11
-- and one fewer on day 12. When Claude PowerPoint is shot it must be titled
-- exactly "Claude PowerPoint" to bind here.
--
-- Written declaratively - "day N points at the video called T" - over all
-- fifteen days rather than as an exchange of two ids. So it is idempotent, it
-- does not care whether the seed has run yet or in which order, and it stays
-- correct if somebody has already fixed one of the two by hand. Days 1-10 and
-- 13-15 are listed and unchanged; they are here so the file states the whole
-- mapping rather than a diff.
--
-- Days 12, 13, 14 and 15 resolve to null because those topics have no row in
-- learn_videos. For 13, 14 and 15 that is the pre-existing "coming soon" state,
-- and for 12 it is the new and intended one.

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
    (11, 'Claude Design 2'),
    (12, 'Claude PowerPoint'),
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
