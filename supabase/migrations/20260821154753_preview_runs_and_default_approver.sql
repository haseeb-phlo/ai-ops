-- Preview runs, and a cohort-level default approver.
--
-- TWO CHANGES:
--
-- 1. A cohort can name one person who signs off everything.
--
--    The org tree routes every exec to the CEO, so an exec cohort would land
--    forty sign-offs on one person who has not agreed to do them. For the
--    first cohorts the honest arrangement is that the programme owner reviews
--    the work, and that is a property of the cohort rather than of the org
--    chart. Once team leads have been through the programme themselves they
--    become credible reviewers and the field is left null, which puts routing
--    back on the org tree.
--
-- 2. Test cohorts stop counting toward "one active cohort per person".
--
--    Without this, an admin cannot sit in a preview run and a real cohort at
--    the same time, which makes previewing the member experience impossible
--    for exactly the people who need to do it. A sandbox membership is not a
--    real enrolment, so it should not consume the one slot.

alter table "public"."programme_cohorts"
  add column if not exists "default_approver_user_id" "uuid"
    references "auth"."users"("id") on delete set null;

comment on column "public"."programme_cohorts"."default_approver_user_id" is
  'One person who signs off every submission in this cohort, overriding the org tree. For early cohorts where the programme owner reviews the work. Null puts routing back on ORG_TREE.';

-- Preview runs are personal, so an admin should be able to wipe theirs and
-- start again without touching anyone else.
comment on column "public"."programme_cohorts"."is_test" is
  'Excluded from all reporting, from the notification crons, and from the one-active-cohort rule. Covers both the seeded rehearsal data and personal preview runs.';

-- =========================================================================
-- The one-active-cohort rule now ignores test cohorts
-- =========================================================================

create or replace function "public"."enforce_single_active_cohort"() returns "trigger"
    language "plpgsql"
    set "search_path" to 'public'
    as $fn$
declare
  v_conflict text;
  v_target_is_test boolean;
begin
  select c.is_test into v_target_is_test
    from public.programme_cohorts c
   where c.id = new.cohort_id;

  -- Joining a preview or rehearsal cohort never conflicts: it is a sandbox,
  -- not an enrolment.
  if coalesce(v_target_is_test, false) then
    return new;
  end if;

  select c.name into v_conflict
    from public.programme_cohort_members m
    join public.programme_cohorts c on c.id = m.cohort_id
   where m.user_id = new.user_id
     and m.id is distinct from new.id
     and c.status in ('planned', 'live')
     -- ...and an existing sandbox membership does not block a real one.
     and not c.is_test
   limit 1;

  if v_conflict is not null then
    if exists (
      select 1 from public.programme_cohorts c
       where c.id = new.cohort_id and c.status in ('planned', 'live')
    ) then
      raise exception 'User is already in an active cohort (%)', v_conflict
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$fn$;

-- =========================================================================
-- Starting and resetting a preview run
-- =========================================================================
-- SECURITY DEFINER for the same narrow reason join_programme_cohort is: a
-- member cannot insert their own roster row, and that policy should stay
-- super-admin-only. This exception is narrower still - it only ever adds the
-- CALLER, only to a cohort marked is_test, and only when the caller is a
-- super admin.

create or replace function "public"."start_programme_preview"() returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_track uuid;
  v_cohort uuid;
  v_name text;
  v_member uuid;
  v_start date;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select id into v_track from public.programme_tracks where slug = 'core-programme';
  if v_track is null then
    return jsonb_build_object('ok', false, 'reason', 'no_track');
  end if;

  -- One preview cohort per admin, so two people previewing do not see each
  -- other's progress and either can reset without affecting the other.
  v_name := 'Preview run - ' || coalesce(public.current_user_email(), auth.uid()::text);

  select id into v_cohort from public.programme_cohorts where name = v_name;

  if v_cohort is null then
    -- Backdated to the Monday three weeks ago so every day is already
    -- unlocked. A preview is for walking the whole thing, not for waiting.
    v_start := (current_date - ((extract(isodow from current_date)::int - 1) + 21))::date;

    insert into public.programme_cohorts
      (name, track_id, start_date, status, is_test, join_open)
    values (v_name, v_track, v_start, 'live', true, false)
    returning id into v_cohort;

    -- Every session gets today's date so attendance can be exercised.
    update public.programme_cohorts c
       set session_dates = (
         select jsonb_object_agg(i.id::text, jsonb_build_array(current_date::text))
           from public.programme_track_items i
          where i.track_id = v_track and i.type = 'session'
       )
     where c.id = v_cohort;
  end if;

  select id into v_member
    from public.programme_cohort_members
   where cohort_id = v_cohort and user_id = auth.uid();

  if v_member is null then
    -- No team lead: a preview has nobody to sign off for you, and the
    -- self-lead CHECK would reject naming yourself. The cohort's default
    -- approver covers it instead, set below.
    insert into public.programme_cohort_members (cohort_id, user_id)
    values (v_cohort, auth.uid())
    returning id into v_member;
  end if;

  -- You approve your own preview submissions. That is nonsense in a real
  -- cohort, which is why programme_sign_off refuses it there, but in a
  -- sandbox it is the only way to see the sign-off screens at all.
  update public.programme_cohorts
     set default_approver_user_id = auth.uid()
   where id = v_cohort and default_approver_user_id is distinct from auth.uid();

  return jsonb_build_object(
    'ok', true, 'cohort_id', v_cohort, 'member_id', v_member, 'name', v_name
  );
end;
$fn$;

alter function "public"."start_programme_preview"() owner to "postgres";
revoke all on function "public"."start_programme_preview"() from "public";
grant execute on function "public"."start_programme_preview"() to "authenticated";

/** Wipes the caller's preview progress so the run can be walked again. */
create or replace function "public"."reset_programme_preview"() returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_cohort uuid;
  v_member uuid;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select c.id, m.id into v_cohort, v_member
    from public.programme_cohorts c
    join public.programme_cohort_members m on m.cohort_id = c.id
   where c.name = 'Preview run - ' || coalesce(public.current_user_email(), auth.uid()::text)
     and m.user_id = auth.uid()
     and c.is_test;

  if v_member is null then
    return jsonb_build_object('ok', false, 'reason', 'no_preview');
  end if;

  delete from public.programme_item_progress where cohort_member_id = v_member;
  delete from public.programme_quiz_attempts where cohort_member_id = v_member;
  delete from public.programme_submissions where cohort_member_id = v_member;
  delete from public.programme_session_attendance
   where cohort_id = v_cohort and user_id = auth.uid();

  update public.programme_cohort_members
     set completed_at = null,
         certificate_issued_at = null,
         certificate_declined_at = null,
         rag_status = null,
         rag_computed_at = null
   where id = v_member;

  -- The check-in responses too, so the entry gate can be walked again. Only
  -- the caller's own, and only the in-app waves: a real May import row is
  -- never touched.
  delete from public.ai_score_responses
   where lower(email) = public.current_user_email()
     and wave in ('cohort_baseline', 'post')
     and source = 'in_app';

  return jsonb_build_object('ok', true, 'cohort_id', v_cohort);
end;
$fn$;

alter function "public"."reset_programme_preview"() owner to "postgres";
revoke all on function "public"."reset_programme_preview"() from "public";
grant execute on function "public"."reset_programme_preview"() to "authenticated";

-- =========================================================================
-- Sign-off learns about the default approver
-- =========================================================================
-- Two additions, both narrow:
--
--   * the cohort's default approver may sign, not only the named team lead;
--   * self-sign-off is permitted in a TEST cohort only, because a preview run
--     has one participant and refusing it would make the sign-off screens
--     unreachable for the person checking them. In a real cohort it stays
--     refused, which is the case that matters.

create or replace function "public"."programme_sign_off"(
  "p_submission_id" "uuid",
  "p_decision" "text",
  "p_accuracy" integer default null,
  "p_completeness" integer default null,
  "p_usefulness" integer default null,
  "p_reusability" integer default null,
  "p_comment" "text" default null,
  "p_capstone_credits" integer default null
) returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_submission record;
  v_member record;
  v_cohort record;
  v_may_sign boolean;
  v_rubric jsonb;
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'bad_decision');
  end if;

  select s.* into v_submission
    from public.programme_submissions s
   where s.id = p_submission_id;
  if v_submission is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select m.* into v_member
    from public.programme_cohort_members m
   where m.id = v_submission.cohort_member_id;
  if v_member is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select c.* into v_cohort
    from public.programme_cohorts c
   where c.id = v_member.cohort_id;

  v_may_sign :=
    coalesce(v_member.team_lead_user_id = auth.uid(), false)
    or coalesce(v_cohort.default_approver_user_id = auth.uid(), false)
    or public.is_super_admin();

  if not v_may_sign then
    return jsonb_build_object('ok', false, 'reason', 'not_your_member');
  end if;

  -- Never sign your own work in a real cohort, whatever the roster says. A
  -- test cohort is a sandbox with one participant, so the rule would only stop
  -- someone checking the screens.
  if v_member.user_id = auth.uid() and not coalesce(v_cohort.is_test, false) then
    return jsonb_build_object('ok', false, 'reason', 'cannot_sign_own_work');
  end if;

  if v_submission.superseded_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'superseded');
  end if;

  if p_decision = 'rejected' and coalesce(btrim(p_comment), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'comment_required');
  end if;

  if p_decision = 'approved' then
    if p_accuracy is null or p_completeness is null
       or p_usefulness is null or p_reusability is null then
      return jsonb_build_object('ok', false, 'reason', 'rubric_required');
    end if;
    if greatest(p_accuracy, p_completeness, p_usefulness, p_reusability) > 5
       or least(p_accuracy, p_completeness, p_usefulness, p_reusability) < 0 then
      return jsonb_build_object('ok', false, 'reason', 'rubric_out_of_range');
    end if;
    if least(p_accuracy, p_completeness, p_usefulness, p_reusability) < 3 then
      return jsonb_build_object('ok', false, 'reason', 'below_threshold');
    end if;
  end if;

  v_rubric := jsonb_strip_nulls(jsonb_build_object(
    'accuracy', p_accuracy,
    'completeness', p_completeness,
    'usefulness', p_usefulness,
    'reusability', p_reusability,
    'credits', case when v_submission.kind = 'capstone'
                    then least(coalesce(p_capstone_credits, 2), 2) end
  ));

  update public.programme_submissions
     set signoff_status = p_decision,
         signoff_rubric_json = v_rubric,
         signoff_comment = nullif(btrim(coalesce(p_comment, '')), ''),
         signed_by = auth.uid(),
         signed_at = now()
   where id = p_submission_id;

  return jsonb_build_object('ok', true, 'decision', p_decision);
end;
$fn$;
