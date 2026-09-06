-- "Catching confident wrong answers" is out of the curriculum, Skills moves
-- from day 9 to day 6, and days 10-15 each shift up one to close the gap.
-- Day 15 becomes "Choosing the right tool + measuring time saved", the topic
-- that came off the end when day 1 was added.
--
-- The topic list itself is a code change (lib/programme/track-spec.ts), and
-- re-running the generated seed carries the new titles and tasks onto a live
-- track, because the seed syncs each item's title and description. What the
-- seed cannot do is re-point learn_video_id: its re-bind block only fills
-- nulls, so that a binding an admin made by hand is never overwritten. That
-- rule is worth keeping and this migration does not change it.
--
-- Without this, the seed renames ten days and moves none of their videos.
-- Five bindings are wrong the moment it runs:
--
--   day  6  none            -> Skills
--   day  9  Skills          -> Scheduled Tasks
--   day 10  Scheduled Tasks -> Reverse Prompting
--   day 11  Reverse Promptg -> Artifacts
--   day 12  Artifacts       -> none, because Design has never been recorded
--
-- The cohorts running now reach day 6 today, so this has to land with the
-- rename rather than after it.
--
-- The last line is the one that differs from
-- 20260903040544_swap_projects_and_connectors_days.sql, which only ever SET a
-- binding, on the argument that a day reading "coming soon" is worse than a
-- stale one. That held when the day's own video simply had not been shot. It
-- does not hold here: day 12 now says "Design" over the Artifacts recording,
-- and a member who presses play watches the wrong topic under a heading that
-- looks right, with nothing on the page to tell them. So this one nulls as
-- well as sets. A day admitting it has no video beats a day lying about which
-- one it has.
--
-- Written declaratively - "day N points at the video called T" - over all
-- fifteen days rather than as five exchanges. So it is idempotent, it does
-- not care whether the seed has run yet, and it stays correct if somebody has
-- already fixed one of the five by hand. Days 1-5 are listed and unchanged;
-- they are here so the file states the whole mapping rather than a diff.
--
-- Days 7, 8, 13, 14 and 15 resolve to null because those topics have no row
-- in learn_videos. That is the pre-existing "coming soon" state for four of
-- them and the correct new state for day 15, and content-readiness.ts already
-- excludes an unbound video day from gate G1 and from the RAG sweep, so no
-- member is marked down for a recording that does not exist.

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
    (7,  'Research, Memory & files out'),
    (8,  'Cowork'),
    (9,  'Scheduled Tasks'),
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
