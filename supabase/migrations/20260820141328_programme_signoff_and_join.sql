-- Sign-off, and self-enrolment by join code.
--
-- TWO THINGS:
--
-- 1. programme_sign_off() - approving your own work must be impossible, so
--    sign-off is an RPC rather than an UPDATE grant. No policy on
--    programme_submissions lets anyone write signoff_status; the only route is
--    through this function, which checks the caller is the member's team lead
--    (or a super admin) and enforces the rubric threshold.
--
-- 2. join_code on programme_cohorts - lets a cohort be opened to its members
--    with a shared code instead of an admin typing out a roster. The code is
--    an ENROLMENT mechanism, not a security boundary: every caller is already
--    an authenticated @wearephlo.com user, so the worst a leaked code does is
--    add a colleague to a training cohort. What it buys is a real cohort row -
--    start date, sessions, roster, reporting - without the manual data entry.

alter table "public"."programme_cohorts"
  add column if not exists "join_code" "text",
  add column if not exists "join_open" boolean default true not null;

create unique index if not exists "programme_cohorts_join_code_key"
  on "public"."programme_cohorts" ("join_code") where ("join_code" is not null);

comment on column "public"."programme_cohorts"."join_code" is
  'Short code members enter to enrol themselves. An enrolment convenience, not a security boundary - every caller is already an authenticated Phlo user.';
comment on column "public"."programme_cohorts"."join_open" is
  'Whether the join code currently accepts new members. Close it once the roster is settled.';

-- =========================================================================
-- Self-enrolment
-- =========================================================================
-- SECURITY DEFINER because a member cannot INSERT into
-- programme_cohort_members - that policy is super-admin only and should stay
-- that way, or anyone could add anyone to anything. This narrows the exception
-- to exactly: add MYSELF, to a cohort whose code I supplied, that is open.

create or replace function "public"."join_programme_cohort"(
  "p_join_code" "text",
  "p_team_lead_user_id" "uuid" default null
) returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_cohort record;
  v_existing record;
  v_member_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select c.* into v_cohort
    from public.programme_cohorts c
   where upper(c.join_code) = upper(btrim(p_join_code))
     and c.join_open
     and c.status in ('planned', 'live')
   limit 1;

  if v_cohort is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  -- Already a member: succeed quietly rather than erroring, so a double
  -- submit or a re-used link is a no-op.
  select m.* into v_existing
    from public.programme_cohort_members m
   where m.cohort_id = v_cohort.id and m.user_id = auth.uid();

  if v_existing is not null then
    return jsonb_build_object('ok', true, 'cohort_id', v_cohort.id, 'already', true);
  end if;

  -- The single-active-cohort trigger would reject this anyway; catching it
  -- here gives the member a sentence they can act on.
  if exists (
    select 1
      from public.programme_cohort_members m
      join public.programme_cohorts c on c.id = m.cohort_id
     where m.user_id = auth.uid() and c.status in ('planned', 'live')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_in_a_cohort');
  end if;

  insert into public.programme_cohort_members (cohort_id, user_id, team_lead_user_id)
  values (
    v_cohort.id,
    auth.uid(),
    -- Never let someone nominate themselves as their own approver.
    case when p_team_lead_user_id = auth.uid() then null else p_team_lead_user_id end
  )
  returning id into v_member_id;

  return jsonb_build_object('ok', true, 'cohort_id', v_cohort.id, 'member_id', v_member_id);
end;
$fn$;

alter function "public"."join_programme_cohort"("text", "uuid") owner to "postgres";
revoke all on function "public"."join_programme_cohort"("text", "uuid") from "public";
grant execute on function "public"."join_programme_cohort"("text", "uuid") to "authenticated";

-- =========================================================================
-- Sign-off
-- =========================================================================
-- Rubric: four 0-5 scores. Approve requires ALL FOUR at 3 or above - one weak
-- dimension should not be averaged away by three strong ones, because the
-- gallery is only worth reading if everything in it is genuinely reusable.
--
-- Rejecting REQUIRES a comment. A rejection with no reason is the fastest way
-- to make someone disengage from the programme altogether.

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
  v_is_lead boolean;
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

  v_is_lead := v_member.team_lead_user_id = auth.uid();

  if not (coalesce(v_is_lead, false) or public.is_super_admin()) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_member');
  end if;

  -- Belt and braces on top of the no-self-lead CHECK: never let anyone sign
  -- off their own work, whatever the roster happens to say.
  if v_member.user_id = auth.uid() then
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
    -- How many signed examples an approved capstone stands in for. Capped at
    -- 2 here as well as in the gate maths.
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

alter function "public"."programme_sign_off"("uuid","text",integer,integer,integer,integer,"text",integer) owner to "postgres";
revoke all on function "public"."programme_sign_off"("uuid","text",integer,integer,integer,integer,"text",integer) from "public";
grant execute on function "public"."programme_sign_off"("uuid","text",integer,integer,integer,integer,"text",integer) to "authenticated";

-- The lead board's main query is "pending submissions for my members".
create index if not exists "programme_submissions_pending_idx"
  on "public"."programme_submissions" ("signoff_status")
  where ("signoff_status" = 'pending');
