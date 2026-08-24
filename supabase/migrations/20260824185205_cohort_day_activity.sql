-- Per-day cohort activity, aggregated, for the member's own heatmap.
--
-- WHY A FUNCTION AND NOT A QUERY. `programme_item_progress` is readable under
-- "read own or led", so a member can see their own rows and a lead can see
-- their team's. That is the right policy and this does not widen it: what the
-- heatmap needs is not anybody's rows but a COUNT of them, and a count of a
-- cohort is not personal data about any member of it.
--
-- SECURITY DEFINER for the same narrow reason join_programme_cohort and
-- start_programme_preview are, and with the same shape of guard: it answers
-- only for a cohort the CALLER is themselves a member of, and it returns only
-- totals. There is no argument that selects a person, and no column that
-- names one, so there is no way to ask it "what has Priya done".
--
-- The denominator deliberately EXCLUDES the caller. "How is everyone else
-- doing" is the question; folding the reader into their own comparison makes
-- the line they are measuring against move when they do work, which is both
-- confusing and slightly flattering.

create or replace function "public"."programme_cohort_day_activity"(
  "p_cohort_id" "uuid"
) returns table (
  "day_index" integer,
  "peers" integer,
  "completions" integer
)
    language "sql" stable security definer
    set "search_path" to 'public'
    as $fn$
  with caller as (
    select m.id, m.cohort_id, c.track_id
      from public.programme_cohort_members m
      join public.programme_cohorts c on c.id = m.cohort_id
     where m.cohort_id = p_cohort_id
       and m.user_id = auth.uid()
  ),
  -- Everyone in the cohort except the reader.
  peer as (
    select m.id
      from public.programme_cohort_members m
     where m.cohort_id = (select cohort_id from caller)
       and m.user_id is distinct from auth.uid()
       and exists (select 1 from caller)
  ),
  -- Only items a member can actually be asked to do: an unrecorded video is
  -- our backlog, and counting it would drag every peer's share down for a day
  -- nobody could have completed. Mirrors gateableContentItemIds.
  actionable as (
    select i.id, i.day_index
      from public.programme_track_items i
     where i.track_id = (select track_id from caller)
       and i.day_index between 1 and 15
       and (
         i.type = 'use_example'
         or (i.type = 'video' and i.learn_video_id is not null)
       )
  )
  select
    a.day_index::integer,
    (select count(*) from peer)::integer as peers,
    count(p.track_item_id)::integer as completions
    from actionable a
    left join public.programme_item_progress p
      on p.track_item_id = a.id
     and p.status = 'complete'
     and p.cohort_member_id in (select id from peer)
   group by a.day_index
   order by a.day_index;
$fn$;

alter function "public"."programme_cohort_day_activity"("uuid") owner to "postgres";
revoke all on function "public"."programme_cohort_day_activity"("uuid") from "public";
grant execute on function "public"."programme_cohort_day_activity"("uuid") to "authenticated";

comment on function "public"."programme_cohort_day_activity"("uuid") is
  'Per-day completion counts across a cohort, excluding the caller. Aggregate only, and only for a cohort the caller belongs to.';
