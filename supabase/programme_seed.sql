-- =========================================================================
-- Core Programme track seed
--
-- GENERATED FILE - do not edit by hand.
-- Source: lib/programme/track-spec.ts   Regenerate: npm run seed:programme
--
-- Idempotent: every insert is guarded, so running this twice is a no-op.
-- Run AFTER migrations. Safe to run against an existing track.
--
-- Learn videos are REFERENCED, never copied: learn_video_id is resolved by
-- exact title match against learn_videos and left null when there's no
-- match, to be bound later in the admin Track-items screen.
-- =========================================================================

insert into public.programme_tracks (name, slug, is_active)
select 'Core Programme', 'core-programme', true
 where not exists (select 1 from public.programme_tracks where slug = 'core-programme');

-- 46 items: day 0 gate, 15 x (video + use_example), 3 sessions,
-- 3 quizzes (end of each week), 8 submission slots, 1 post check-in.
with track as (
  select id from public.programme_tracks where slug = 'core-programme'
), spec(type, title, description, day_index, sort_order, learn_video_title, config_json) as (
  values
    ('questionnaire_baseline', 'Your AI Score — 3-minute check-in', 'A quick self-assessment. It sets your starting point and unlocks the programme.', 0, 0, null, '{}'::jsonb),
    ('video', 'When to use AI and when not to', null, 1, 0, 'When to use AI and when not to', '{}'::jsonb),
    ('use_example', 'When to use AI and when not to — try it yourself', 'Apply the day''s technique to something on your own desk.', 1, 1, null, '{}'::jsonb),
    ('submission_slot', 'Work sample (before)', null, 1, 4, null, '{"kind":"work_sample_pre","visibility":"private"}'::jsonb),
    ('video', 'CRISP Framework', null, 2, 0, 'CRISP Framework', '{}'::jsonb),
    ('use_example', 'CRISP Framework — try it yourself', 'Apply the day''s technique to something on your own desk.', 2, 1, null, '{}'::jsonb),
    ('video', 'Connectors & MCP', null, 3, 0, 'Connectors & MCP', '{}'::jsonb),
    ('use_example', 'Connectors & MCP — try it yourself', 'Apply the day''s technique to something on your own desk.', 3, 1, null, '{}'::jsonb),
    ('session', 'Live session 1', null, 3, 2, null, '{"slots":2}'::jsonb),
    ('submission_slot', 'Signed example 1', null, 3, 4, null, '{"kind":"signed_example","visibility":"cohort"}'::jsonb),
    ('video', 'Projects', null, 4, 0, 'Projects', '{}'::jsonb),
    ('use_example', 'Projects — try it yourself', 'Apply the day''s technique to something on your own desk.', 4, 1, null, '{}'::jsonb),
    ('video', 'Catching confident wrong answers', null, 5, 0, 'Catching confident wrong answers', '{}'::jsonb),
    ('use_example', 'Catching confident wrong answers — try it yourself', 'Apply the day''s technique to something on your own desk.', 5, 1, null, '{}'::jsonb),
    ('quiz', 'Week 1 check', null, 5, 3, null, '{"pass_mark":4,"question_count":5,"summative":false,"questions":[]}'::jsonb),
    ('video', 'Research, Memory & files out', null, 6, 0, 'Research, Memory & files out', '{}'::jsonb),
    ('use_example', 'Research, Memory & files out — try it yourself', 'Apply the day''s technique to something on your own desk.', 6, 1, null, '{}'::jsonb),
    ('submission_slot', 'Signed example 2', null, 6, 4, null, '{"kind":"signed_example","visibility":"cohort"}'::jsonb),
    ('video', 'Cowork', null, 7, 0, 'Cowork', '{}'::jsonb),
    ('use_example', 'Cowork — try it yourself', 'Apply the day''s technique to something on your own desk.', 7, 1, null, '{}'::jsonb),
    ('video', 'Skills', null, 8, 0, 'Skills', '{}'::jsonb),
    ('use_example', 'Skills — try it yourself', 'Apply the day''s technique to something on your own desk.', 8, 1, null, '{}'::jsonb),
    ('session', 'Live session 2', null, 8, 2, null, '{"slots":2}'::jsonb),
    ('video', 'Scheduled Tasks', null, 9, 0, 'Scheduled Tasks', '{}'::jsonb),
    ('use_example', 'Scheduled Tasks — try it yourself', 'Apply the day''s technique to something on your own desk.', 9, 1, null, '{}'::jsonb),
    ('submission_slot', 'Signed example 3', null, 9, 4, null, '{"kind":"signed_example","visibility":"cohort"}'::jsonb),
    ('video', 'Reverse Prompting', null, 10, 0, 'Reverse Prompting', '{}'::jsonb),
    ('use_example', 'Reverse Prompting — try it yourself', 'Apply the day''s technique to something on your own desk.', 10, 1, null, '{}'::jsonb),
    ('quiz', 'Week 2 check', null, 10, 3, null, '{"pass_mark":4,"question_count":5,"summative":false,"questions":[]}'::jsonb),
    ('video', 'Artifacts', null, 11, 0, 'Artifacts', '{}'::jsonb),
    ('use_example', 'Artifacts — try it yourself', 'Apply the day''s technique to something on your own desk.', 11, 1, null, '{}'::jsonb),
    ('video', 'Design', null, 12, 0, 'Design', '{}'::jsonb),
    ('use_example', 'Design — try it yourself', 'Apply the day''s technique to something on your own desk.', 12, 1, null, '{}'::jsonb),
    ('submission_slot', 'Signed example 4', null, 12, 4, null, '{"kind":"signed_example","visibility":"cohort"}'::jsonb),
    ('video', 'Dispatch + Plugins', null, 13, 0, 'Dispatch + Plugins', '{}'::jsonb),
    ('use_example', 'Dispatch + Plugins — try it yourself', 'Apply the day''s technique to something on your own desk.', 13, 1, null, '{}'::jsonb),
    ('session', 'Live session 3', null, 13, 2, null, '{"slots":2}'::jsonb),
    ('submission_slot', 'Capstone', null, 13, 4, null, '{"kind":"capstone","visibility":"cohort"}'::jsonb),
    ('video', 'Claude everywhere', null, 14, 0, 'Claude everywhere', '{}'::jsonb),
    ('use_example', 'Claude everywhere — try it yourself', 'Apply the day''s technique to something on your own desk.', 14, 1, null, '{}'::jsonb),
    ('submission_slot', 'Signed example 5', null, 14, 4, null, '{"kind":"signed_example","visibility":"cohort"}'::jsonb),
    ('video', 'Choosing the right tool + measuring time saved', null, 15, 0, 'Choosing the right tool + measuring time saved', '{}'::jsonb),
    ('use_example', 'Choosing the right tool + measuring time saved — try it yourself', 'Apply the day''s technique to something on your own desk.', 15, 1, null, '{}'::jsonb),
    ('quiz', 'Final quiz', null, 15, 3, null, '{"pass_mark":8,"question_count":10,"summative":true,"questions":[]}'::jsonb),
    ('submission_slot', 'Work sample (after)', null, 15, 4, null, '{"kind":"work_sample_post","visibility":"private"}'::jsonb),
    ('questionnaire_post', 'Your AI Score — see what three weeks did', null, 15, 5, null, '{}'::jsonb)
)
insert into public.programme_track_items
  (track_id, type, title, description, day_index, sort_order, learn_video_id, config_json)
select t.id, s.type, s.title, s.description, s.day_index, s.sort_order,
       (select v.id from public.learn_videos v where lower(v.title) = lower(s.learn_video_title) limit 1),
       s.config_json
  from spec s cross join track t
 where not exists (
   select 1 from public.programme_track_items i
    where i.track_id = t.id and i.day_index = s.day_index and i.sort_order = s.sort_order
 );

-- Re-bind any day whose Learn video has since been added. Only fills nulls,
-- so an admin's manual binding is never overwritten.
--
-- VIDEO ITEMS ONLY. A use_example is the "now go do it" half of the day and
-- stays unbound: if it shared the video, one tick on /learn would complete
-- both items and G1 would be reachable without doing any exercise.
update public.programme_track_items i
   set learn_video_id = v.id
  from public.learn_videos v
 where i.learn_video_id is null
   and i.type = 'video'
   and lower(v.title) = lower(i.title)
   and i.track_id = (select id from public.programme_tracks where slug = 'core-programme');
