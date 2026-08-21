-- AI-assisted sign-off.
--
-- WHY: G3 needs five approved examples plus a capstone per person, so a
-- cohort of eight is roughly fifty reviews and a cohort of fifty is three
-- hundred. The people in the first two cohorts are the exec team and the
-- team leads, who will not do them - and a gate nobody enforces is a gate
-- that certifies submission rather than capability.
--
-- So a model reviews first, against the same four criteria a human uses.
-- Clear passes are approved automatically with written feedback. Anything
-- borderline, anything a model cannot fairly judge, and every capstone go
-- to a human with the draft already filled in, so the human decision is
-- confirm-or-override rather than compose-from-scratch.
--
-- WHAT THIS MIGRATION DOES NOT DO: it grants nobody any new write. The
-- review runs server-side with the service-role client, exactly as the cron
-- jobs do, because the alternative - an RPC a member could call - would let
-- someone hand themselves four fives. There is deliberately no path from a
-- member's session to an AI approval.

-- ========================================================================
-- Per-cohort switch
-- ========================================================================

alter table "public"."programme_cohorts"
  add column if not exists "review_mode" "text" not null default 'ai_assisted';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programme_cohorts_review_mode_check'
  ) then
    alter table "public"."programme_cohorts"
      add constraint "programme_cohorts_review_mode_check"
      check ("review_mode" in ('human', 'ai_assisted'));
  end if;
end $$;

comment on column "public"."programme_cohorts"."review_mode" is
  'ai_assisted: a model reviews first and clear passes are approved automatically, with everything else routed to the approver. human: every submission waits for a person. Switching to human mid-cohort does not un-approve anything already decided.';

-- ========================================================================
-- What the model said, kept whatever it decided
-- ========================================================================
-- Stored even when the review is only advisory, because the first question
-- anyone asks about an automated approval is "on what basis" and the answer
-- has to survive the request that produced it.

alter table "public"."programme_submissions"
  add column if not exists "ai_review_json" "jsonb",
  add column if not exists "ai_reviewed_at" timestamp with time zone,
  add column if not exists "ai_decision" "text";

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programme_submissions_ai_decision_check'
  ) then
    alter table "public"."programme_submissions"
      add constraint "programme_submissions_ai_decision_check"
      check ("ai_decision" is null or "ai_decision" in ('approved', 'flagged', 'error'));
  end if;
end $$;

comment on column "public"."programme_submissions"."ai_decision" is
  'approved: the model passed it and signoff_status was set to approved with signed_by null. flagged: routed to a human, with the draft rubric in ai_review_json. error: the review could not run, so it waits for a human like any other.';

comment on column "public"."programme_submissions"."ai_review_json" is
  'The full review: per-criterion scores, the feedback shown to the member, the reasons it was flagged, and the model used. Kept for every outcome so an approval can be explained after the fact.';

-- The backstop sweep looks for submissions the after() callback never got to.
create index if not exists "programme_submissions_awaiting_review_idx"
  on "public"."programme_submissions" ("created_at")
  where "signoff_status" = 'pending' and "ai_reviewed_at" is null;
