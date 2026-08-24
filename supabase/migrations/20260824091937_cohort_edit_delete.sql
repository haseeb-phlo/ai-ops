-- Deleting a cohort, and switching one between test and real.
--
-- Both of these look like one-line updates and are not, which is why they
-- are RPCs rather than table writes from an action.
--
-- WHAT A COHORT DELETE ACTUALLY TOUCHES:
--
--   programme_cohort_members    on delete CASCADE
--     -> programme_item_progress    CASCADE
--     -> programme_submissions      CASCADE
--     -> programme_quiz_attempts    CASCADE
--   programme_session_attendance  on delete CASCADE
--   ai_score_responses            on delete SET NULL
--
-- So a bare DELETE destroys the whole training record of everyone in it -
-- the thing CLAUDE.md's soft-delete rule exists to protect - and the SET NULL
-- is worse than it looks: a test cohort's fixture responses lose their
-- cohort_id AND their membership row in the same statement, which is both
-- of the legs reporting uses to exclude them. Delete a rehearsal cohort
-- naively and its invented answers quietly join the company average.
--
-- Hence: refuse when real work exists, clean the responses first, and make
-- the caller type the name.

create or replace function "public"."programme_delete_cohort"(
  "p_cohort_id" "uuid",
  "p_confirm_name" "text"
) returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_cohort record;
  v_members int;
  v_submissions int;
  v_attempts int;
  v_attendance int;
  v_progress int;
  v_responses int;
  v_kept int;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select * into v_cohort from public.programme_cohorts where id = p_cohort_id;
  if v_cohort is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Typed confirmation. The list of cohorts is short and the rows look alike,
  -- and there is no undo behind this.
  if lower(btrim(coalesce(p_confirm_name, ''))) is distinct from lower(btrim(v_cohort.name)) then
    return jsonb_build_object('ok', false, 'reason', 'name_mismatch');
  end if;

  select count(*) into v_members
    from public.programme_cohort_members where cohort_id = p_cohort_id;

  select count(*) into v_submissions
    from public.programme_submissions s
    join public.programme_cohort_members m on m.id = s.cohort_member_id
   where m.cohort_id = p_cohort_id;

  select count(*) into v_attempts
    from public.programme_quiz_attempts q
    join public.programme_cohort_members m on m.id = q.cohort_member_id
   where m.cohort_id = p_cohort_id;

  select count(*) into v_progress
    from public.programme_item_progress p
    join public.programme_cohort_members m on m.id = p.cohort_member_id
   where m.cohort_id = p_cohort_id;

  select count(*) into v_attendance
    from public.programme_session_attendance where cohort_id = p_cohort_id;

  -- A REAL cohort where anyone has done anything is never deleted. Archive it
  -- instead: the status already exists, it drops out of every active view,
  -- and the record survives. A test cohort has no record worth keeping, which
  -- is what makes it a test cohort.
  if not v_cohort.is_test
     and (v_submissions + v_attempts + v_progress + v_attendance) > 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'has_work',
      'counts', jsonb_build_object(
        'members', v_members,
        'submissions', v_submissions,
        'quiz_attempts', v_attempts,
        'progress', v_progress,
        'attendance', v_attendance
      )
    );
  end if;

  -- Responses BEFORE the cohort, and keyed on WHO rather than on cohort_id.
  --
  -- Measured on the seeded rehearsal cohort: all thirty-six of its responses
  -- carry cohort_id = NULL, because a response is keyed on email and the
  -- column is nullable by design for the May wave. So reporting excludes
  -- them purely through the by-person leg - membership -> test cohort - and
  -- that leg is what the cascade destroys. Scoping this delete to cohort_id
  -- would match nothing and leave invented answers in the company average.
  --
  -- Only people whose ONLY membership is this cohort. An admin with a
  -- preview run and a real cohort is a real participant, and their baseline
  -- is their own; the same rule reporting uses in sandboxOnlyUserIds.
  --
  -- Only the in-app waves. A may_2026 row is source='import' and is somebody
  -- genuinely answering in May; it survives its author leaving every cohort.
  delete from public.ai_score_responses r
   where r.source = 'in_app'
     and r.wave in ('cohort_baseline', 'post')
     and lower(r.email) in (
       select lower(u.email)
         from public.programme_cohort_members m
         join auth.users u on u.id = m.user_id
        where m.cohort_id = p_cohort_id
          and not exists (
            select 1
              from public.programme_cohort_members other
              join public.programme_cohorts oc on oc.id = other.cohort_id
             where other.user_id = m.user_id
               and other.cohort_id <> p_cohort_id
               and not oc.is_test
          )
     );
  get diagnostics v_responses = row_count;

  -- Imported May answers belonging to those same people are deliberately
  -- kept: someone who answered in May answered for real, and losing that
  -- because they were once in a sandbox would be the worse mistake. Counted
  -- so the admin is told rather than left to discover it in a chart.
  select count(*) into v_kept
    from public.ai_score_responses r
   where r.source = 'import'
     and lower(r.email) in (
       select lower(u.email)
         from public.programme_cohort_members m
         join auth.users u on u.id = m.user_id
        where m.cohort_id = p_cohort_id
     );

  delete from public.programme_cohorts where id = p_cohort_id;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'name', v_cohort.name,
      'members', v_members,
      'responses', v_responses,
      'imported_responses_kept', v_kept,
      'submissions', v_submissions,
      'attendance', v_attendance
    )
  );
end;
$fn$;

alter function "public"."programme_delete_cohort"("uuid", "text") owner to "postgres";
revoke all on function "public"."programme_delete_cohort"("uuid", "text") from "public";
grant execute on function "public"."programme_delete_cohort"("uuid", "text") to "authenticated";

comment on function "public"."programme_delete_cohort"("uuid", "text") is
  'Deletes a cohort and everything cascading from it. Refuses on a real cohort where any work exists - archive that instead. Removes the cohort''s in-app AI Score responses first, because the FK is ON DELETE SET NULL and orphaned fixture answers would otherwise enter the company numbers.';

-- =========================================================================
-- Switching a cohort between test and real
-- =========================================================================
-- Not a column update, for two reasons that only bite in one direction.
--
-- 1. The one-active-cohort rule is a trigger on programme_cohort_members, so
--    it does not fire when the COHORT's is_test changes. Making a test cohort
--    real can therefore put someone in two live cohorts at once, silently,
--    which is the invariant the trigger exists to hold.
--
-- 2. A preview run is a personal sandbox: backdated three weeks so nothing is
--    locked, and the one place programme_sign_off allows self-approval. Its
--    approvals were never independently reviewed, so promoting one to a real
--    cohort would launder them into the record. Refused outright.
--
-- Going the other way is allowed with no checks. It hides the cohort from
-- every report and every notification, which is a decision an admin is
-- entitled to make - the UI says so plainly rather than the database
-- second-guessing it.

create or replace function "public"."programme_set_cohort_test"(
  "p_cohort_id" "uuid",
  "p_is_test" boolean
) returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_cohort record;
  v_conflict text;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select * into v_cohort from public.programme_cohorts where id = p_cohort_id;
  if v_cohort is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_cohort.is_test = p_is_test then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  if not p_is_test then
    if v_cohort.name like 'Preview run - %' then
      return jsonb_build_object('ok', false, 'reason', 'preview_run');
    end if;

    -- The check the member trigger would have made, made here instead.
    select u.email into v_conflict
      from public.programme_cohort_members m
      join public.programme_cohort_members other
        on other.user_id = m.user_id and other.id <> m.id
      join public.programme_cohorts oc on oc.id = other.cohort_id
      join auth.users u on u.id = m.user_id
     where m.cohort_id = p_cohort_id
       and oc.status in ('planned', 'live')
       and not oc.is_test
     limit 1;

    if v_conflict is not null then
      return jsonb_build_object(
        'ok', false, 'reason', 'member_in_another_cohort', 'email', v_conflict
      );
    end if;
  end if;

  update public.programme_cohorts set is_test = p_is_test where id = p_cohort_id;
  return jsonb_build_object('ok', true, 'is_test', p_is_test);
end;
$fn$;

alter function "public"."programme_set_cohort_test"("uuid", boolean) owner to "postgres";
revoke all on function "public"."programme_set_cohort_test"("uuid", boolean) from "public";
grant execute on function "public"."programme_set_cohort_test"("uuid", boolean) to "authenticated";

comment on function "public"."programme_set_cohort_test"("uuid", boolean) is
  'Switches a cohort between test and real. Making one real re-checks the one-active-cohort rule, which the member trigger cannot see from here, and refuses outright for a preview run because self-approval is permitted there.';
