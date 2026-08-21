-- Editing the feedback on a decided submission.
--
-- WHY: automatic review writes the feedback a member reads. Whoever owns the
-- cohort should be able to correct anything that does not sound right before
-- or after the member sees it, without having to reverse the decision - the
-- score was fine, the wording was not.
--
-- WHAT THE MEMBER SEES: the corrected text, with no edit trail and no
-- "automatically reviewed" label once a person has rewritten it. That is not
-- concealment. After an edit a human has read the work and written what the
-- member reads, so attributing it to the machine would be the inaccurate
-- version. The original stays in ai_review_json for anyone auditing.
--
-- AN RPC, NOT A GRANT, for the same reason programme_sign_off is: there is no
-- UPDATE policy on the sign-off columns anywhere, and adding one so a lead
-- could edit a comment would also let a member edit their own.

create or replace function "public"."programme_edit_feedback"(
  "p_submission_id" "uuid",
  "p_comment" "text"
) returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public'
    as $fn$
declare
  v_submission record;
  v_member record;
  v_cohort record;
  v_previous text;
  v_audit jsonb;
begin
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

  -- Same three ways in as signing off. Notably NOT the member: being able to
  -- rewrite your own feedback would make the record worthless.
  if not (
    coalesce(v_member.team_lead_user_id = auth.uid(), false)
    or coalesce(v_cohort.default_approver_user_id = auth.uid(), false)
    or public.is_super_admin()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_member');
  end if;

  if v_submission.signoff_status = 'pending' then
    -- Nothing has been decided, so there is no feedback to correct. Editing
    -- here would write a comment the sign-off flow is about to overwrite.
    return jsonb_build_object('ok', false, 'reason', 'still_pending');
  end if;

  if coalesce(btrim(p_comment), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  v_previous := v_submission.signoff_comment;

  -- Keep every version. One edit is a correction; a column that only holds
  -- the latest turns a series of them into an unanswerable question.
  v_audit := coalesce(v_submission.ai_review_json, '{}'::jsonb);
  v_audit := jsonb_set(
    v_audit,
    '{edits}',
    coalesce(v_audit->'edits', '[]'::jsonb) || jsonb_build_object(
      'at', now(),
      'by', auth.uid(),
      'replaced', v_previous
    )
  );

  update public.programme_submissions
     set signoff_comment = btrim(p_comment),
         -- A person wrote what the member now reads, so the member is no
         -- longer told a machine did.
         signoff_rubric_json =
           case
             when signoff_rubric_json->>'reviewer' = 'ai'
               then jsonb_set(signoff_rubric_json, '{reviewer}', '"human_edited"'::jsonb)
             else signoff_rubric_json
           end,
         ai_review_json = v_audit
   where id = p_submission_id;

  return jsonb_build_object('ok', true);
end;
$fn$;

alter function "public"."programme_edit_feedback"("uuid", "text") owner to "postgres";
revoke all on function "public"."programme_edit_feedback"("uuid", "text") from "public";
grant execute on function "public"."programme_edit_feedback"("uuid", "text") to "authenticated";

comment on function "public"."programme_edit_feedback"("uuid", "text") is
  'Corrects the written feedback on an already-decided submission, without touching the decision or the scores. Approver-only. Every previous version is kept in ai_review_json.edits.';
