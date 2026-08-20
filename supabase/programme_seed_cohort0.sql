-- =========================================================================
-- "Cohort 0 - Test" - local/dev fixture for the Core Programme track.
--
-- Run AFTER supabase/programme_seed.sql. Idempotent.
--
-- is_test = true, which excludes this cohort from every reporting surface
-- (Part 7) and from the company average on the AI Score result screen.
--
-- Covers the four cases that break naive implementations:
--   * a RETURNER  - has a may_2026 response, so the score form must pre-fill
--     and be submittable unchanged in under 60 seconds;
--   * a FIRST-TIMER - no prior wave, so no radar overlay and no delta chip;
--   * a TEAM LEAD WHO IS ALSO A MEMBER - their own work must route to THEIR
--     lead, never to themselves (the no-self-lead CHECK);
--   * a MID-COHORT JOINER - joined late, so RAG owes them 5 working days'
--     grace before amber.
--
-- NOTE ON THE LEARN VIDEO: this file inserts one clearly-labelled sample row
-- into learn_videos, because a fresh local database has none and Part 2's
-- acceptance ("watching a Learn video marks progress") is untestable with
-- nothing bound. This is a DEV FIXTURE ONLY - the programme itself never
-- writes to Learn tables, it only references them.
-- =========================================================================

-- 1. A sample Learn video for day 1 to point at ---------------------------
insert into public.learn_videos (title, description, loom_share_url, loom_embed_id, topic, position)
select 'When to use AI and when not to',
       'Sample video for local development (Cohort 0 fixture).',
       'https://www.loom.com/share/00000000000000000000000000000000',
       '00000000000000000000000000000000',
       'ai_foundations',
       1
 where not exists (
   select 1 from public.learn_videos where lower(title) = lower('When to use AI and when not to')
 );

-- Bind the matching VIDEO item, now the video exists. Video items only - a
-- use_example stays unbound so watching can't auto-complete the exercise.
update public.programme_track_items i
   set learn_video_id = v.id
  from public.learn_videos v
 where i.learn_video_id is null
   and i.type = 'video'
   and lower(v.title) = lower(i.title)
   and i.track_id = (select id from public.programme_tracks where slug = 'core-programme');

-- 2. The cohort -----------------------------------------------------------
-- start_date is a Monday, as the schema expects. 2026-08-03 is far enough in
-- the past that days 1-15 have all unlocked, so every surface has data.
insert into public.programme_cohorts (name, track_id, start_date, status, is_test)
select 'Cohort 0 — Test', t.id, date '2026-08-03', 'live', true
  from public.programme_tracks t
 where t.slug = 'core-programme'
   and not exists (select 1 from public.programme_cohorts where name = 'Cohort 0 — Test');

-- 3. Session dates --------------------------------------------------------
-- Keyed by track_item id. Session 1 gets TWO dates (a dual slot) so the
-- roster's slot handling and "attending either satisfies the item" rule are
-- exercised; sessions 2 and 3 are single-slot.
update public.programme_cohorts c
   set session_dates = sd.dates
  from (
    select jsonb_object_agg(
             i.id::text,
             case i.day_index
               when 3  then jsonb_build_array('2026-08-05', '2026-08-06')
               when 8  then jsonb_build_array('2026-08-12')
               else         jsonb_build_array('2026-08-19')
             end
           ) as dates
      from public.programme_track_items i
      join public.programme_tracks t on t.id = i.track_id
     where t.slug = 'core-programme' and i.type = 'session'
  ) sd
 where c.name = 'Cohort 0 — Test' and c.session_dates = '{}'::jsonb;

-- 4. Test users ----------------------------------------------------------
-- Deterministic ids so the fixture is reproducible and re-runnable. A fresh
-- database has no auth users at all (seed.sql seeds `people`, not logins), so
-- the fixture creates its own rather than depending on who happens to have
-- signed in. Sign in as any of them locally with:
--   /auth/dev-login?email=cohort0.returner@wearephlo.com
--
-- These inserts fire on_auth_user_created (creating profiles) and
-- enforce_phlo_email_trigger, which is exactly what we want to exercise.
--
-- The empty-string token columns are load-bearing, not noise. GoTrue scans
-- confirmation_token / recovery_token / email_change / email_change_token_new
-- into Go `string` rather than `*string`, so leaving them NULL makes every
-- lookup fail with "Database error finding user" - dev-login included, which
-- would make these fixture users unusable.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token, phone_change,
  phone_change_token
)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, '', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('display_name', v.display_name),
       '', '', '', '', '', '', '', ''
  from (values
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'cohort0.returner@wearephlo.com',   'Cohort0 Returner'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'cohort0.firsttimer@wearephlo.com', 'Cohort0 First-timer'),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'cohort0.leadmember@wearephlo.com', 'Cohort0 Lead-and-member'),
    ('c0000000-0000-4000-8000-000000000004'::uuid, 'cohort0.seniorlead@wearephlo.com', 'Cohort0 Senior lead'),
    ('c0000000-0000-4000-8000-000000000005'::uuid, 'cohort0.joiner@wearephlo.com',     'Cohort0 Mid-cohort joiner')
  ) as v(id, email, display_name)
 where not exists (select 1 from auth.users u where u.id = v.id);

-- 5. Members ---------------------------------------------------------------
-- Lead routing:
--   returner, first-timer, joiner -> lead-and-member (ord 3)
--   lead-and-member               -> senior lead      (their own work routes
--                                                      UP, never to themselves)
--   senior lead                   -> not a cohort member
insert into public.programme_cohort_members
  (cohort_id, user_id, team_lead_user_id, is_champion, joined_at)
select co.id, v.user_id, v.lead_id, v.is_champion,
       case when v.late then co.start_date::timestamptz + interval '9 days'
            else co.start_date::timestamptz end
  from (values
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'c0000000-0000-4000-8000-000000000003'::uuid, false, false),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'c0000000-0000-4000-8000-000000000003'::uuid, false, false),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'c0000000-0000-4000-8000-000000000004'::uuid, true,  false),
    ('c0000000-0000-4000-8000-000000000005'::uuid, 'c0000000-0000-4000-8000-000000000003'::uuid, false, true)
  ) as v(user_id, lead_id, is_champion, late)
  cross join (select id, start_date from public.programme_cohorts where name = 'Cohort 0 — Test') co
 where not exists (
   select 1 from public.programme_cohort_members m
    where m.cohort_id = co.id and m.user_id = v.user_id
 );

-- 6. The returner's May 2026 response --------------------------------------
-- A COMPLETE May response (q1-q23), because that is what a real returner has.
-- It matters for the 60-second test: with everything carried forward, the only
-- thing left to answer is q19b, which is new in the cohort_baseline wave.
--
-- Two axes sit at 0 so the day-15 "New this cohort" achievements have
-- something to find, and the overall score has room to move.
insert into public.ai_score_responses (email, user_id, wave, source, answers_json, submitted_at)
values (
  'cohort0.returner@wearephlo.com',
  'c0000000-0000-4000-8000-000000000001',
  'may_2026',
  'import',
  jsonb_build_object(
    'q1',  jsonb_build_object('value', 'I write structured prompts with context, role and clear instructions. Most prompts work first time.', 'score', 2),
    'q2',  jsonb_build_object('value', 'I''ve heard of them but haven''t used one.', 'score', 1),
    'q3',  jsonb_build_object('value', 'I don''t know what Artefacts are.', 'score', 0),
    'q4',  jsonb_build_object('value', 'I''ve heard of them but don''t know how to set one up.', 'score', 1),
    'q5',  jsonb_build_object('value', 'I don''t know what MCP or Connectors are.', 'score', 0),
    'q6',  jsonb_build_object('value', 'I''ve heard of them but haven''t added one.', 'score', 1),
    'q7',  jsonb_build_object('value', 'I have logged in but don''t know how to use it.', 'score', 1),
    'q8',  jsonb_build_object('value', 'ChatGPT occasionally.'),
    'q9',  jsonb_build_object('value', 'Agree'),
    'q10', jsonb_build_object('value', 'Neutral'),
    'q11', jsonb_build_object('value', 'Disagree'),
    'q12', jsonb_build_object('value', 'Neutral'),
    'q13', jsonb_build_object('value', 'Agree'),
    'q14', jsonb_build_object('value', 'Neutral'),
    'q15', jsonb_build_object('value', 'Disagree'),
    'q16', jsonb_build_object('value', 'Interested & learning the basics'),
    'q17', jsonb_build_object('value', 'The pace and approach is right - it feels sustainable.'),
    'q18', jsonb_build_object('value', '3'),
    'q19', jsonb_build_object('value', '2-3 hours ish'),
    'q20', jsonb_build_object('value', 'Not knowing where to start.'),
    'q21', jsonb_build_object('value', 'Day-to-day admin.'),
    'q22', jsonb_build_object('value', 'Drafting patient comms faster.'),
    'q23', jsonb_build_object('value', '')
  ),
  timestamptz '2026-05-14 10:00:00+00'
)
on conflict (email, wave) do nothing;
