-- Days 4 and 5 of the Core Programme swapped: Projects now leads, Connectors
-- & MCP follows it.
--
-- The topic swap itself is a code change (lib/programme/track-spec.ts), and
-- re-running the generated seed applies it to a live track, because the seed
-- syncs each item's title and description. What the seed does NOT sync is
-- learn_video_id: its re-bind block only fills nulls, deliberately, so that a
-- binding an admin made by hand in the Track-items screen is never
-- overwritten. That rule is worth keeping and this migration does not change
-- it.
--
-- But it means a seed run against an existing track renames day 4 to
-- "Projects" while it is still pointing at the Connectors video, and day 5 to
-- "Connectors & MCP" while it points at Projects. Two days playing each
-- other's video, with nothing on the page saying so - a member watches the
-- wrong thing and has no way to tell. The cohorts running now are on day 4
-- this week, so this needs to land with the rename rather than after it.
--
-- Written declaratively - "day 4 points at the video called Projects" -
-- rather than as an exchange of the two ids. So it is idempotent, it does not
-- care whether the seed has run yet, and it is still correct if someone has
-- already fixed one of the two by hand.
--
-- Each statement no-ops when the Learn video does not exist, leaving the
-- current binding alone rather than nulling it: an unbound day renders
-- "coming soon", which is a worse outcome than a stale binding an admin can
-- see and fix.

update public.programme_track_items i
   set learn_video_id = (
         select v.id
           from public.learn_videos v
          where lower(v.title) = lower('Projects')
          limit 1
       )
 where i.track_id = (
         select id from public.programme_tracks where slug = 'core-programme'
       )
   and i.type = 'video'
   and i.day_index = 4
   and exists (
         select 1
           from public.learn_videos v
          where lower(v.title) = lower('Projects')
       );

update public.programme_track_items i
   set learn_video_id = (
         select v.id
           from public.learn_videos v
          where lower(v.title) = lower('Connectors & MCP')
          limit 1
       )
 where i.track_id = (
         select id from public.programme_tracks where slug = 'core-programme'
       )
   and i.type = 'video'
   and i.day_index = 5
   and exists (
         select 1
           from public.learn_videos v
          where lower(v.title) = lower('Connectors & MCP')
       );
