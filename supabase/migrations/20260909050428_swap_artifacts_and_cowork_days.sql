-- Days 8 and 11 of the Core Programme swapped: Artifacts moves forward to day
-- 8 and Cowork goes back to day 11.
--
-- The topic list is a code change (lib/programme/track-spec.ts), and re-running
-- the generated seed carries the new titles, tasks and quiz questions onto a
-- live track, because the seed syncs each item's title, description and
-- config_json. What the seed cannot do is re-point learn_video_id: its re-bind
-- block only fills nulls, so that a binding an admin made by hand in the
-- Track-items screen is never overwritten. That rule is worth keeping and this
-- migration does not change it.
--
-- Half of this swap the seed CAN do and half it cannot:
--
--   day 8   none      -> Artifacts, which the seed fills, because day 8's
--                        binding is null today and its new title matches a
--                        learn_videos row
--   day 11  Artifacts -> none, which the seed does NOT do, because Cowork has
--                        never been recorded and the re-bind only fills nulls
--
-- So without this, day 11 keeps pointing at the Artifacts recording under a
-- heading reading "Cowork". That is the failure this file exists for, and it
-- is why this migration NULLS as well as SETS, following
-- 20260906234040_drop_verification_day_and_shift_topics.sql rather than the
-- earlier 20260903040544_swap_projects_and_connectors_days.sql, which only ever
-- set on the argument that a stale binding beats "coming soon". That argument
-- holds when a day's own video simply has not been shot. It does not hold here:
-- a member who presses play on day 11 would watch Artifacts, which they were
-- taught on day 8, under a title that looks right, with nothing on the page to
-- tell them. A day admitting it has no video beats a day lying about which one
-- it has.
--
-- WHY THIS DIRECTION. Day 8 is the day two live cohorts reached on 2026-09-09
-- and it had no video, so it read "coming soon" on the morning people were
-- looking at it. Day 11 does not unlock for those cohorts until 2026-09-14.
-- The swap moves the one real recording of the pair onto the day that was
-- failing in front of people and leaves the gap on a day that has a weekend of
-- notice. The number of recorded days does not change; which day has one does.
--
-- Written declaratively - "day N points at the video called T" - over all
-- fifteen days rather than as an exchange of two ids. So it is idempotent, it
-- does not care whether the seed has run yet or in which order, and it stays
-- correct if somebody has already fixed one of the two by hand. Days 1-7 and
-- 9-15 are listed and unchanged; they are here so the file states the whole
-- mapping rather than a diff.
--
-- Days 9, 11, 12, 13, 14 and 15 resolve to null because those topics have no
-- row in learn_videos. For 9, 12, 13, 14 and 15 that is the pre-existing
-- "coming soon" state, and for 11 it is the new and intended one.
-- content-readiness.ts already excludes an unbound video day from gate G1 and
-- from the RAG sweep, so no member is marked down for a recording that does
-- not exist.

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
    (9,  'Research, Memory & files out'),
    (10, 'Reverse Prompting'),
    (11, 'Cowork'),
    (12, 'Design'),
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
