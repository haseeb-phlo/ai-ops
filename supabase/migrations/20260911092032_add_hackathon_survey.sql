-- Hackathon problem survey: "What should we fix on Monday?"
--
-- One response per person, collected before the hackathon, then pooled into a
-- problem bank the respondents read themselves. Three things about that shape
-- drive everything below.
--
-- 1. WHO CAN SEE IT IS A COHORT PROPERTY, NOT A LIST OF PEOPLE.
--    The survey is for the first cohort (Cohort 1A + 1B), but hardcoding
--    those two uuids into policies would mean a migration every time another
--    cohort runs a hackathon. `programme_cohorts.hackathon_access` is the
--    flag; flipping it in Studio or a later migration is the whole change.
--
-- 2. READING OTHER PEOPLE'S ROWS DEPENDS ON HAVING ONE OF YOUR OWN.
--    "Everyone's problems can be seen after you complete the survey" is a
--    select policy on this table whose predicate reads this table. Written
--    inline that is infinite recursion - Postgres raises
--    "infinite recursion detected in policy for relation ...", so the read
--    fails outright rather than silently blanking. Both predicates therefore
--    go through SECURITY DEFINER helpers, the same reason
--    `is_super_admin()`/`can_edit_intervention()` exist.
--
-- 3. ANSWERS ARE ONE JSONB BLOB, and `lib/hackathon/questions.ts` is the
--    only thing that names the questions - exactly as `ai_score_responses`
--    treats `lib/programme/questions.ts`. Hours-per-week is NOT stored: it
--    is a pure function of two stored answers (`lib/hackathon/impact.ts`),
--    and a derived column would be one more dual-write to keep honest for no
--    read we cannot do in 31 rows of TypeScript.

-- =========================================================================
-- programme_cohorts.hackathon_access
-- =========================================================================

alter table "public"."programme_cohorts"
    add column if not exists "hackathon_access" boolean default false not null;

comment on column "public"."programme_cohorts"."hackathon_access" is
    'Members of this cohort can open /hackathon and its problem bank. Set for the first cohort (1A + 1B); flip it per cohort rather than editing policies.';

-- Idempotent and name-matched rather than id-matched, so it is safe to
-- re-run and readable without a uuid lookup. `is_test = false` keeps the
-- rehearsal cohort and preview runs out.
update "public"."programme_cohorts"
   set "hackathon_access" = true
 where "name" in ('Cohort 1A', 'Cohort 1B')
   and "is_test" = false;

-- =========================================================================
-- Helper functions
-- =========================================================================

-- "Is the caller in a cohort that has hackathon access?"
--
-- SECURITY DEFINER because a policy that subqueries programme_cohort_members
-- has that table's own RLS applied inside the subquery, which returns zero
-- rows instead of an error - the silent failure mode programme_core.sql's
-- header warns about.
--
-- NOTE: auth.uid() is the REAL user even under view-as user mode, so a super
-- admin impersonating a cohort member is judged on their own membership.
-- That is why the policies below also carry an is_super_admin() arm.
create or replace function "public"."has_hackathon_access"() returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1
      from public.programme_cohort_members m
      join public.programme_cohorts c on c.id = m.cohort_id
     where m.user_id = auth.uid()
       and c.hackathon_access
  );
$$;

alter function "public"."has_hackathon_access"() owner to "postgres";

-- =========================================================================
-- hackathon_survey_responses
-- =========================================================================
-- One row per person, revisable: `created_at` is when they first answered,
-- `submitted_at` is the latest submit. The action upserts on user_id.

create table if not exists "public"."hackathon_survey_responses" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "user_id" "uuid" not null,
    -- Denormalised so the bank and any export can label a row without
    -- reaching into auth.users, which no user JWT can read.
    "email" "text" not null,
    -- Which cohort the respondent was in when they answered. Nullable and
    -- `on delete set null`: the answer outlives the cohort record, and the
    -- problem bank feeds later cohorts too.
    "cohort_id" "uuid",
    -- { "q1": { "value": "Patient Care" }, ... }. Question ids and option
    -- strings are owned by lib/hackathon/questions.ts.
    "answers_json" "jsonb" default '{}'::"jsonb" not null,
    -- Client-measured, for the same fatigue tripwire ai_score_responses uses.
    "duration_seconds" integer,
    "submitted_at" timestamp with time zone default "now"() not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "hackathon_survey_responses_duration_check"
        check (("duration_seconds" is null)
               or (("duration_seconds" >= 0) and ("duration_seconds" <= 86400)))
);

alter table "public"."hackathon_survey_responses" owner to "postgres";

alter table only "public"."hackathon_survey_responses"
    add constraint "hackathon_survey_responses_pkey" primary key ("id");
-- One response per person. This is the `onConflict` target for the upsert,
-- and it is what makes "One response per person" true rather than asked for.
alter table only "public"."hackathon_survey_responses"
    add constraint "hackathon_survey_responses_user_id_key" unique ("user_id");
alter table only "public"."hackathon_survey_responses"
    add constraint "hackathon_survey_responses_user_id_fkey" foreign key ("user_id")
    references "auth"."users"("id") on delete cascade;
alter table only "public"."hackathon_survey_responses"
    add constraint "hackathon_survey_responses_cohort_id_fkey" foreign key ("cohort_id")
    references "public"."programme_cohorts"("id") on delete set null;

create index if not exists "hackathon_survey_responses_cohort_idx"
    on "public"."hackathon_survey_responses" using "btree" ("cohort_id");
create index if not exists "hackathon_survey_responses_submitted_idx"
    on "public"."hackathon_survey_responses" using "btree" ("submitted_at" desc);

alter table "public"."hackathon_survey_responses" enable row level security;

-- Declared here rather than with the other helper above: a `language sql`
-- body has its relations resolved at CREATE FUNCTION time, so a function
-- reading this table cannot precede it.
-- "Has the caller submitted their own response yet?" - the key to the bank.
-- SECURITY DEFINER for the recursion reason in note 2 above, not for
-- privilege: it reads exactly the row the caller can already read.
create or replace function "public"."has_hackathon_response"() returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.hackathon_survey_responses r
     where r.user_id = auth.uid()
  );
$$;

alter function "public"."has_hackathon_response"() owner to "postgres";

-- Your own row always; everyone else's only once you have one of your own and
-- your cohort is invited; super admins throughout, because `requireWriter()`
-- blocks mutations while impersonating, so the person running the hackathon
-- may legitimately never have a response of their own.
create policy "read hackathon_survey_responses" on "public"."hackathon_survey_responses"
    for select to "authenticated"
    using (
      "user_id" = "auth"."uid"()
      or ("public"."has_hackathon_access"() and "public"."has_hackathon_response"())
      or "public"."is_super_admin"()
    );

-- Write your OWN row, and only while your cohort is invited - or you are a
-- super admin, who runs the hackathon without necessarily being enrolled on
-- a cohort and would otherwise be shown a form that cannot submit. `user_id
-- = auth.uid()` holds in both arms, so the widening is "may answer", never
-- "may answer as someone else".
--
-- Insert and update are split so a `with check` typo cannot silently widen
-- the other.
create policy "insert own hackathon_survey_response" on "public"."hackathon_survey_responses"
    for insert to "authenticated"
    with check (
      "user_id" = "auth"."uid"()
      and ("public"."has_hackathon_access"() or "public"."is_super_admin"())
    );

create policy "update own hackathon_survey_response" on "public"."hackathon_survey_responses"
    for update to "authenticated"
    using (
      "user_id" = "auth"."uid"()
      and ("public"."has_hackathon_access"() or "public"."is_super_admin"())
    )
    with check (
      "user_id" = "auth"."uid"()
      and ("public"."has_hackathon_access"() or "public"."is_super_admin"())
    );

-- Deleting a response deletes a problem out of the bank, which is the one
-- operation nobody should be able to do to their own table by accident.
create policy "super_admin delete hackathon_survey_responses" on "public"."hackathon_survey_responses"
    for delete to "authenticated"
    using ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."hackathon_survey_responses" to "anon";
grant all on table "public"."hackathon_survey_responses" to "authenticated";
grant all on table "public"."hackathon_survey_responses" to "service_role";
