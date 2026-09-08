-- Days 7 and 9 of the Core Programme swapped: Scheduled Tasks moves forward to
-- day 7 and "Research, Memory & files out" takes day 9.
--
-- The topic list is a code change (lib/programme/track-spec.ts), and re-running
-- the generated seed carries the new titles and tasks onto a live track,
-- because the seed syncs each item's title and description. What the seed
-- cannot do is re-point learn_video_id: its re-bind block only fills nulls, so
-- that a binding an admin made by hand in the Track-items screen is never
-- overwritten. That rule is worth keeping and this migration does not change
-- it.
--
-- Without this, the seed renames both days and moves neither video:
--
--   day 7  none            -> Scheduled Tasks
--   day 9  Scheduled Tasks -> none, because Research has never been recorded
--
-- So this one SETS and NULLS, following
-- 20260906234040_drop_verification_day_and_shift_topics.sql rather than the
-- earlier 20260903040544_swap_projects_and_connectors_days.sql, which only ever
-- set. The reasoning is the same as the newer one: leave day 9 pointing at the
-- Scheduled Tasks recording and a member who presses play under a "Research,
-- Memory & files out" heading watches the wrong topic, with nothing on the page
-- to tell them. A day admitting it has no video beats a day lying about which
-- one it has.
--
-- Day 7 is the day that gains, and it gains a real recording: it read "coming
-- soon" before this, and the Scheduled Tasks video arrives with the topic.
-- That is the reason the swap ran in this direction rather than the curriculum
-- losing a day.
--
-- Written declaratively - "day N points at the video called T" - over all
-- fifteen days rather than as an exchange of two ids. So it is idempotent, it
-- does not care whether the seed has run yet, and it stays correct if somebody
-- has already fixed one of the two by hand. Days 1-6 and 10-15 are listed and
-- unchanged; they are here so the file states the whole mapping rather than a
-- diff.
--
-- Days 8, 9, 13, 14 and 15 resolve to null because those topics have no row in
-- learn_videos. For 8, 13 and 14 that is the pre-existing "coming soon" state,
-- for 15 it is the state the September reorder left, and for 9 it is the new
-- and intended one. content-readiness.ts already excludes an unbound video day
-- from gate G1 and from the RAG sweep, so no member is marked down for a
-- recording that does not exist.

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
    (8,  'Cowork'),
    (9,  'Research, Memory & files out'),
    (10, 'Reverse Prompting'),
    (11, 'Artifacts'),
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
