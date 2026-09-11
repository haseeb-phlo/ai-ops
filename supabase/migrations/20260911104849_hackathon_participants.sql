-- The hackathon's audience is its own list of people, not a training cohort.
--
-- The previous migration derived access from `programme_cohorts`, on the
-- assumption that the hackathon was for the first cohort. It is not: the
-- people invited to the hackathon are a separate group, overlapping the
-- cohorts only by coincidence. Deriving one from the other was therefore
-- wrong in the way that is hardest to spot later - it worked, it just
-- admitted the wrong thirty-one people.
--
-- So: an explicit register, and three consequences worth stating.
--
-- 1. KEYED ON EMAIL, NOT user_id. Most of the company has no `auth.users`
--    row until their first sign-in, and the list has to be loadable before
--    the invitation goes out, not after everyone has clicked it. Same reason
--    `ai_score_responses` and `programme_pending_enrolments` are email-keyed.
--    A participant added today works the moment they first sign in.
--
-- 2. The cohort flag and the response's cohort attribution go with it.
--    Leaving `hackathon_access` on `programme_cohorts` would leave a column
--    that looks like it decides something and does not.
--
-- 3. `has_hackathon_access()` keeps its name and its callers. Only the body
--    changes, so the policies on `hackathon_survey_responses` - including
--    the recursion-avoiding read gate - are untouched.

-- =========================================================================
-- hackathon_participants
-- =========================================================================

create table if not exists "public"."hackathon_participants" (
    "id" "uuid" default "gen_random_uuid"() not null,
    -- Lowercased, and checked rather than trusted: the access lookup is an
    -- equality match against `current_user_email()`, which lowercases. One
    -- capitalised row here is one person silently locked out.
    "email" "text" not null,
    "added_by" "uuid",
    "created_at" timestamp with time zone default "now"() not null,
    constraint "hackathon_participants_email_lowercase_check"
        check ("email" = lower("email"))
);

alter table "public"."hackathon_participants" owner to "postgres";

alter table only "public"."hackathon_participants"
    add constraint "hackathon_participants_pkey" primary key ("id");
alter table only "public"."hackathon_participants"
    add constraint "hackathon_participants_email_key" unique ("email");
-- The register outlives the person's account: removing somebody from the
-- app should not quietly remove whoever added them from the audit.
alter table only "public"."hackathon_participants"
    add constraint "hackathon_participants_added_by_fkey" foreign key ("added_by")
    references "auth"."users"("id") on delete set null;

alter table "public"."hackathon_participants" enable row level security;

-- You may see that you are on the list, and super admins see all of it.
-- Nobody else gets the guest list: it is the invitation, not public
-- information, and the survey names the teams people work in.
create policy "read own hackathon_participants" on "public"."hackathon_participants"
    for select to "authenticated"
    using ("email" = "public"."current_user_email"() or "public"."is_super_admin"());

create policy "super_admin write hackathon_participants" on "public"."hackathon_participants"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."hackathon_participants" to "anon";
grant all on table "public"."hackathon_participants" to "authenticated";
grant all on table "public"."hackathon_participants" to "service_role";

-- =========================================================================
-- Access now reads the register
-- =========================================================================
-- Same name, same signature, same callers - so every policy that already
-- depends on it keeps working. SECURITY DEFINER for the same reason as
-- before: a policy that subqueries an RLS-protected table has that table's
-- RLS applied inside the subquery, and would blank rather than error.
--
-- NOTE: `current_user_email()` resolves the REAL user even under view-as
-- user mode, which is why the survey's policies carry a separate
-- is_super_admin() arm.
create or replace function "public"."has_hackathon_access"() returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.hackathon_participants p
     where p.email = public.current_user_email()
  );
$$;

alter function "public"."has_hackathon_access"() owner to "postgres";

-- =========================================================================
-- Remove what the cohort assumption left behind
-- =========================================================================

alter table "public"."programme_cohorts" drop column if exists "hackathon_access";

drop index if exists "public"."hackathon_survey_responses_cohort_idx";
alter table "public"."hackathon_survey_responses" drop column if exists "cohort_id";
