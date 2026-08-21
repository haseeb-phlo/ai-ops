-- =========================================================================
-- "Rehearsal" cohort: a finished cohort with realistic data.
--
-- LOCAL AND PREVIEW ONLY. is_test = true, so it is excluded from every
-- reporting figure and from the notification crons by default. The reporting
-- tab has an "include rehearsal data" toggle for walking someone through the
-- charts; leave it off and this cohort is invisible.
--
-- Run AFTER programme_seed.sql. Idempotent.
--
-- Why it exists: until a real cohort finishes, every admin screen is empty or
-- shows four fixture members with nothing done. That is a bad way to check
-- whether a screen works, and a worse way to show it to anyone. This gives a
-- complete cohort - three waves of responses, attendance, submissions,
-- sign-offs, quiz attempts and a gallery - so the whole thing can be walked
-- end to end before it matters.
--
-- The numbers are deliberately unflattering in places: two people did not
-- finish, one submission was sent back, capability on some axes barely moved
-- and one person's self-assessment went DOWN. A demo where everything is green
-- teaches you nothing about how the screens read on a bad week.
-- =========================================================================

-- 1. Twelve people -------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token, phone_change,
  phone_change_token
)
select
  ('d0000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'rehearsal' || g || '@wearephlo.com', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from generate_series(1, 12) g
where not exists (
  select 1 from auth.users u
   where u.id = ('d0000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid
);

-- Readable names and a spread of teams, so the function rollup has something
-- to roll up.
update public.profiles p
   set display_name = v.name
  from (values
    (1,  'Ana Whitfield'),   (2,  'Ben Osei'),
    (3,  'Cara Lindsay'),    (4,  'Dev Mistry'),
    (5,  'Ellie Fraser'),    (6,  'Farid Haddad'),
    (7,  'Grace Nwosu'),     (8,  'Hamish Bell'),
    (9,  'Iona Reid'),       (10, 'Jamal Price'),
    (11, 'Kirsty Dunn'),     (12, 'Liam Okafor')
  ) as v(n, name)
 where p.user_id = ('d0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid
   and p.display_name is distinct from v.name;

insert into public.people (email, display_name, team, title)
select 'rehearsal' || v.n || '@wearephlo.com', v.name, v.team, 'Rehearsal'
  from (values
    (1,  'Ana Whitfield', 'Dispensary'),        (2,  'Ben Osei', 'Dispensary'),
    (3,  'Cara Lindsay', 'Patient Care'),       (4,  'Dev Mistry', 'Technology'),
    (5,  'Ellie Fraser', 'Technology'),         (6,  'Farid Haddad', 'Data & Automation'),
    (7,  'Grace Nwosu', 'Finance'),             (8,  'Hamish Bell', 'Digital Marketing'),
    (9,  'Iona Reid', 'Fulfilment'),            (10, 'Jamal Price', 'Patient Services'),
    (11, 'Kirsty Dunn', 'People'),              (12, 'Liam Okafor', 'Product')
  ) as v(n, name, team)
on conflict (email) do nothing;

-- 2. The cohort, finished ------------------------------------------------
insert into public.programme_cohorts
  (name, track_id, start_date, status, is_test, join_code)
select 'Rehearsal cohort', t.id, date '2026-06-01', 'complete', true, 'REHEARSE'
  from public.programme_tracks t
 where t.slug = 'core-programme'
   and not exists (select 1 from public.programme_cohorts where name = 'Rehearsal cohort');

update public.programme_cohorts c
   set session_dates = sd.dates
  from (
    select jsonb_object_agg(
             i.id::text,
             case i.day_index
               when 3  then jsonb_build_array('2026-06-03', '2026-06-04')
               when 8  then jsonb_build_array('2026-06-10')
               else         jsonb_build_array('2026-06-17')
             end
           ) as dates
      from public.programme_track_items i
      join public.programme_tracks t on t.id = i.track_id
     where t.slug = 'core-programme' and i.type = 'session'
  ) sd
 where c.name = 'Rehearsal cohort' and c.session_dates = '{}'::jsonb;

-- 3. Members. Person 1 leads 2-6, person 4 leads 7-12, person 1 reports to 4.
insert into public.programme_cohort_members
  (cohort_id, user_id, team_lead_user_id, is_champion, joined_at)
select co.id,
       ('d0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
       ('d0000000-0000-4000-8000-0000000000' || lpad(v.lead::text, 2, '0'))::uuid,
       v.champion,
       co.start_date::timestamptz
  from (values
    (1, 4, true),  (2, 1, false), (3, 1, false), (4, 1, false),
    (5, 1, false), (6, 1, false), (7, 4, true),  (8, 4, false),
    (9, 4, false), (10, 4, false), (11, 4, false), (12, 4, false)
  ) as v(n, lead, champion)
  cross join (select id, start_date from public.programme_cohorts where name = 'Rehearsal cohort') co
 where not exists (
   select 1 from public.programme_cohort_members m
    where m.cohort_id = co.id
      and m.user_id = ('d0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid
 );

-- 4. Three waves of responses -------------------------------------------
-- may_2026: a low, uneven baseline matching the real May distribution shape.
-- cohort_baseline: slightly higher, which is the organic drift.
-- post: higher again, unevenly - Artefacts and Skills move most, AI Ops least,
-- and person 9's self-assessment goes DOWN, which is the recalibration the
-- delta chip exists to render kindly.
insert into public.ai_score_responses
  (email, user_id, wave, source, flow, duration_seconds, answers_json, submitted_at)
select
  'rehearsal' || g || '@wearephlo.com',
  ('d0000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  w.wave, w.source, w.flow, w.seconds,
  (
    select jsonb_object_agg(
             'q' || q,
             jsonb_build_object('value', 'seeded', 'score',
               greatest(0, least(4,
                 -- Explicit per-wave levels rather than additive lifts: an
                 -- additive model clips at 4 for the people who started high,
                 -- which silently compresses the later wave and made the
                 -- programme look worse than the drift it is measured against.
                 w.base
                 -- A little spread between people, so the mean is not the
                 -- whole story and the improved/level/declined split is real.
                 + case (g % 3) when 0 then -1 when 1 then 0 else 1 end
                 -- Artefacts and Skills move most, AI Ops least, matching what
                 -- the curriculum actually spends time on.
                 + case when q in (3, 6) then w.topic_lift
                        when q = 7 then -1
                        else 0 end
                 -- One person recalibrates downward after training, which is
                 -- the case the delta chip exists to render kindly.
                 - case when g = 9 and w.wave = 'post' then 2 else 0 end
               ))
             )
           )
      from generate_series(1, 7) q
  )
  || jsonb_build_object('q9',  jsonb_build_object('value', w.likert))
  || jsonb_build_object('q19b', jsonb_build_object('value', w.band)),
  w.submitted
from generate_series(1, 12) g
cross join (values
  -- base is the typical level for that wave; topic_lift is the extra the
  -- curriculum buys on the areas it spends most time on.
  ('may_2026',        'import', null,       null::int, 1, 0, 'Neutral', '1-3',  timestamptz '2026-05-14 10:00:00+00'),
  ('cohort_baseline', 'in_app', 'returner', 52,        1, 1, 'Agree',   '1-3',  timestamptz '2026-06-01 09:10:00+00'),
  ('post',            'in_app', 'returner', 61,        3, 1, 'Agree',   '5-10', timestamptz '2026-06-19 16:40:00+00')
) as w(wave, source, flow, seconds, base, topic_lift, likert, band, submitted)
on conflict (email, wave) do nothing;

-- 5. Progress: ten finished everything, two did not ----------------------
insert into public.programme_item_progress
  (cohort_member_id, track_item_id, status, completed_at)
select m.id, i.id, 'complete', timestamptz '2026-06-19 12:00:00+00'
  from public.programme_cohort_members m
  join public.programme_cohorts c on c.id = m.cohort_id
  join auth.users u on u.id = m.user_id
  cross join public.programme_track_items i
  join public.programme_tracks t on t.id = i.track_id
 where c.name = 'Rehearsal cohort'
   and t.slug = 'core-programme'
   and i.type in ('video', 'use_example')
   and i.learn_video_id is not null or (i.type = 'use_example' and c.name = 'Rehearsal cohort')
   -- Persons 11 and 12 tail off after week two.
   and not (u.email in ('rehearsal11@wearephlo.com', 'rehearsal12@wearephlo.com')
            and i.day_index > 10)
on conflict (cohort_member_id, track_item_id) do nothing;

-- 6. Attendance: near-full, with one excused make-up and one absence -----
insert into public.programme_session_attendance
  (cohort_id, track_item_id, user_id, status, slot, meta_json)
select c.id, i.id, m.user_id,
       case
         when u.email = 'rehearsal11@wearephlo.com' and i.day_index = 13 then 'absent'
         when u.email = 'rehearsal9@wearephlo.com'  and i.day_index = 8  then 'excused'
         else 'attended'
       end,
       case when i.day_index = 3 then 1 + (m.id::text ~ '^[0-7]')::int else null end,
       case when u.email = 'rehearsal9@wearephlo.com' and i.day_index = 8
            then '{"make_up": true}'::jsonb else '{}'::jsonb end
  from public.programme_cohort_members m
  join public.programme_cohorts c on c.id = m.cohort_id
  join auth.users u on u.id = m.user_id
  cross join public.programme_track_items i
  join public.programme_tracks t on t.id = i.track_id
 where c.name = 'Rehearsal cohort' and t.slug = 'core-programme' and i.type = 'session'
on conflict (cohort_id, track_item_id, user_id) do nothing;

-- 7. Submissions, including one sent back and one still pending ----------
insert into public.programme_submissions
  (cohort_member_id, track_item_id, kind, prompt_text, task_solved,
   time_saved_estimate, visibility, signoff_status, signoff_rubric_json,
   signoff_comment, signed_by, signed_at)
select m.id, i.id, 'signed_example',
       'You are helping the ' || p.team || ' team at Phlo, a UK digital pharmacy.' || chr(10) ||
       'Take the attached weekly export and produce a short summary for the team' || chr(10) ||
       'meeting: the three numbers that moved most, one line on why, and anything' || chr(10) ||
       'that needs a decision. Match the tone of last week''s summary, which is' || chr(10) ||
       'also attached. Keep it under 200 words.',
       'The Monday summary that used to take most of an hour',
       (array['2 hours a week', '45 minutes a week', '3 hours a week', '90 minutes a week'])[1 + (i.day_index % 4)],
       case when i.day_index in (3, 6) then 'public_gallery' else 'cohort' end,
       case
         when u.email = 'rehearsal8@wearephlo.com' and i.day_index = 14 then 'rejected'
         when u.email = 'rehearsal10@wearephlo.com' and i.day_index = 14 then 'pending'
         else 'approved'
       end,
       case when u.email = 'rehearsal8@wearephlo.com' and i.day_index = 14
            then '{}'::jsonb
            else '{"accuracy": 4, "completeness": 4, "usefulness": 5, "reusability": 4}'::jsonb end,
       case when u.email = 'rehearsal8@wearephlo.com' and i.day_index = 14
            then 'Good result, but paste the actual prompt rather than describing it - the point is that someone else can run it.'
            else null end,
       m.team_lead_user_id,
       timestamptz '2026-06-18 11:00:00+00'
  from public.programme_cohort_members m
  join public.programme_cohorts c on c.id = m.cohort_id
  join auth.users u on u.id = m.user_id
  join public.people p on lower(p.email) = lower(u.email)
  cross join public.programme_track_items i
  join public.programme_tracks t on t.id = i.track_id
 where c.name = 'Rehearsal cohort'
   and t.slug = 'core-programme'
   and i.type = 'submission_slot'
   and i.config_json->>'kind' = 'signed_example'
   and not (u.email in ('rehearsal11@wearephlo.com', 'rehearsal12@wearephlo.com') and i.day_index > 9)
   and not exists (
     select 1 from public.programme_submissions s
      where s.cohort_member_id = m.id and s.track_item_id = i.id
   );

-- 8. Quiz attempts: a first go that missed, then a pass ------------------
insert into public.programme_quiz_attempts
  (cohort_member_id, track_item_id, score, answers_json, created_at)
select m.id, i.id, v.score, '{}'::jsonb, v.at
  from public.programme_cohort_members m
  join public.programme_cohorts c on c.id = m.cohort_id
  join auth.users u on u.id = m.user_id
  cross join public.programme_track_items i
  join public.programme_tracks t on t.id = i.track_id
  cross join (values
    (6, timestamptz '2026-06-19 09:00:00+00'),
    (9, timestamptz '2026-06-19 09:20:00+00')
  ) as v(score, at)
 where c.name = 'Rehearsal cohort' and t.slug = 'core-programme'
   and i.type = 'quiz' and (i.config_json->>'summative')::boolean
   and u.email not in ('rehearsal11@wearephlo.com', 'rehearsal12@wearephlo.com')
   and not exists (
     select 1 from public.programme_quiz_attempts a
      where a.cohort_member_id = m.id and a.track_item_id = i.id
   );

-- 9. Completion and certificates -----------------------------------------
-- Ten completed. Eight have their certificate issued; two sit in the approval
-- queue, so that screen has something in it.
update public.programme_cohort_members m
   set completed_at = timestamptz '2026-06-19 17:00:00+00'
  from public.programme_cohorts c, auth.users u
 where c.id = m.cohort_id and u.id = m.user_id
   and c.name = 'Rehearsal cohort'
   and u.email not in ('rehearsal11@wearephlo.com', 'rehearsal12@wearephlo.com')
   and m.completed_at is null;

update public.programme_cohort_members m
   set certificate_issued_at = timestamptz '2026-06-20 09:00:00+00'
  from public.programme_cohorts c, auth.users u
 where c.id = m.cohort_id and u.id = m.user_id
   and c.name = 'Rehearsal cohort'
   and u.email not in ('rehearsal9@wearephlo.com', 'rehearsal10@wearephlo.com',
                       'rehearsal11@wearephlo.com', 'rehearsal12@wearephlo.com')
   and m.completed_at is not null
   and m.certificate_issued_at is null;

update public.programme_cohort_members m
   set rag_status = case
         when m.completed_at is not null then 'green'
         else 'red' end,
       rag_computed_at = now()
  from public.programme_cohorts c
 where c.id = m.cohort_id and c.name = 'Rehearsal cohort';
