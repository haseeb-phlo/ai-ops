-- Core Programme track: a sequencing-and-tracking layer over the existing
-- Learn section that runs Phlo's mandatory 15-day AI training per cohort.
--
-- Design constraints this migration encodes:
--
-- 1. Learn is REFERENCED, never copied. `programme_track_items.learn_video_id`
--    points at `learn_videos`; no video row, play, or completion is ever
--    duplicated into a programme table. `on delete set null` so removing a
--    Learn video unbinds the day rather than deleting the track item.
--
-- 2. RLS is explicit on every table. A `public` table created without
--    policies is not an error - it silently returns zero rows to
--    `authenticated`. There is also an `rls_auto_enable` event trigger on the
--    live database (absent from these migrations, because global objects
--    aren't in a `--schema public` dump), so being explicit is what keeps
--    fresh-local and linked-prod behaving identically.
--
-- 3. Cross-table policy predicates go through SECURITY DEFINER helpers. A
--    policy that subqueries another RLS-protected table has that table's RLS
--    applied inside the subquery, which silently blanks results. Same pattern
--    as the existing `can_edit_intervention` / `can_delete_workflow`.
--
-- 4. There is no "team lead" role. `role_grants.role` is constrained to
--    super_admin|member and is deliberately left alone. A lead is anyone
--    named as `programme_cohort_members.team_lead_user_id` on at least one
--    row - a query, not a grant.

-- =========================================================================
-- Helper functions
-- =========================================================================

-- Inlined as `exists (select 1 from role_grants ...)` in ~20 existing
-- policies; extracted here because the programme adds many more and the
-- subquery needs SECURITY DEFINER when called from a policy on a table the
-- caller can't otherwise read.
create or replace function "public"."is_super_admin"() returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.role_grants g
     where g.user_id = auth.uid() and g.role = 'super_admin'
  );
$$;

alter function "public"."is_super_admin"() owner to "postgres";

-- The caller's email, lowercased. `ai_score_responses` is keyed on email
-- rather than user_id (May 2026 respondents predate their auth.users row, and
-- some have never signed in at all), so self-read policies on that table need
-- to resolve auth.uid() -> email. Reading auth.users requires SECURITY
-- DEFINER; auth.jwt() would also work but breaks for service-role callers.
--
-- NOTE: under view-as *user* mode auth.uid() is still the real super_admin,
-- so this returns the super_admin's email while impersonating. That is
-- intentional and safe - the super_admin policy carries those reads.
create or replace function "public"."current_user_email"() returns "text"
    language "sql" stable security definer
    set "search_path" to 'public', 'auth'
    as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;

alter function "public"."current_user_email"() owner to "postgres";

-- =========================================================================
-- programme_tracks
-- =========================================================================

create table if not exists "public"."programme_tracks" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "name" "text" not null,
    "slug" "text" not null,
    "is_active" boolean default true not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null
);

alter table "public"."programme_tracks" owner to "postgres";

alter table only "public"."programme_tracks"
    add constraint "programme_tracks_pkey" primary key ("id");
alter table only "public"."programme_tracks"
    add constraint "programme_tracks_slug_key" unique ("slug");

alter table "public"."programme_tracks" enable row level security;

create policy "auth read programme_tracks" on "public"."programme_tracks"
    for select to "authenticated" using (true);
create policy "super_admin write programme_tracks" on "public"."programme_tracks"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_tracks" to "anon";
grant all on table "public"."programme_tracks" to "authenticated";
grant all on table "public"."programme_tracks" to "service_role";

-- =========================================================================
-- programme_track_items
-- =========================================================================
-- day_index 0 is the entry gate (the baseline "Your AI Score" check-in);
-- 1-15 are the programme days. sort_order breaks ties within a day - a day
-- holds a video, its use_example, and sometimes a session or quiz.

create table if not exists "public"."programme_track_items" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "track_id" "uuid" not null,
    "type" "text" not null,
    "learn_video_id" "uuid",
    "title" "text" not null,
    "description" "text",
    "day_index" integer not null,
    "sort_order" integer default 0 not null,
    "config_json" "jsonb" default '{}'::"jsonb" not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_track_items_type_check" check (("type" = any (array[
        'questionnaire_baseline'::"text", 'video'::"text", 'use_example'::"text",
        'session'::"text", 'quiz'::"text", 'questionnaire_post'::"text",
        'submission_slot'::"text"]))),
    constraint "programme_track_items_day_index_check" check (("day_index" >= 0) and ("day_index" <= 15))
);

alter table "public"."programme_track_items" owner to "postgres";

alter table only "public"."programme_track_items"
    add constraint "programme_track_items_pkey" primary key ("id");
alter table only "public"."programme_track_items"
    add constraint "programme_track_items_track_id_fkey" foreign key ("track_id")
    references "public"."programme_tracks"("id") on delete cascade;
-- set null, not cascade: unbinding a Learn video must not delete the day.
alter table only "public"."programme_track_items"
    add constraint "programme_track_items_learn_video_id_fkey" foreign key ("learn_video_id")
    references "public"."learn_videos"("id") on delete set null;

-- (track, day, sort_order) is unique, which is also the key the generated
-- seed guards on. Without it, two items accidentally given the same slot
-- would make the seed silently insert one and skip the other rather than
-- failing loudly.
alter table only "public"."programme_track_items"
    add constraint "programme_track_items_track_day_sort_key" unique ("track_id", "day_index", "sort_order");

create index if not exists "programme_track_items_track_day_idx"
    on "public"."programme_track_items" using "btree" ("track_id", "day_index", "sort_order");

alter table "public"."programme_track_items" enable row level security;

create policy "auth read programme_track_items" on "public"."programme_track_items"
    for select to "authenticated" using (true);
create policy "super_admin write programme_track_items" on "public"."programme_track_items"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_track_items" to "anon";
grant all on table "public"."programme_track_items" to "authenticated";
grant all on table "public"."programme_track_items" to "service_role";

-- =========================================================================
-- programme_cohorts
-- =========================================================================

create table if not exists "public"."programme_cohorts" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "name" "text" not null,
    "track_id" "uuid" not null,
    "start_date" "date" not null,
    -- One entry per session track_item: { "<track_item_id>": ["2026-09-02", "2026-09-03"] }.
    -- Two dates = dual slot; attending either satisfies the item.
    "session_dates" "jsonb" default '{}'::"jsonb" not null,
    "status" "text" default 'planned'::"text" not null,
    -- Excludes "Cohort 0 - Test" from every reporting surface (Part 7).
    "is_test" boolean default false not null,
    -- Unused until Part 8; carried here so notifications don't need a
    -- one-column migration later.
    "slack_channel" "text",
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_cohorts_status_check" check (("status" = any (array[
        'planned'::"text", 'live'::"text", 'complete'::"text", 'archived'::"text"])))
);

alter table "public"."programme_cohorts" owner to "postgres";

alter table only "public"."programme_cohorts"
    add constraint "programme_cohorts_pkey" primary key ("id");
alter table only "public"."programme_cohorts"
    add constraint "programme_cohorts_track_id_fkey" foreign key ("track_id")
    references "public"."programme_tracks"("id") on delete restrict;

create index if not exists "programme_cohorts_status_idx"
    on "public"."programme_cohorts" using "btree" ("status");

alter table "public"."programme_cohorts" enable row level security;

-- Readable by everyone: members need their cohort's name and start_date to
-- render unlock dates, and the gallery labels submissions by cohort.
create policy "auth read programme_cohorts" on "public"."programme_cohorts"
    for select to "authenticated" using (true);
create policy "super_admin write programme_cohorts" on "public"."programme_cohorts"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_cohorts" to "anon";
grant all on table "public"."programme_cohorts" to "authenticated";
grant all on table "public"."programme_cohorts" to "service_role";

-- =========================================================================
-- programme_cohort_members
-- =========================================================================
-- rag_status is denormalised onto the member row because it's recomputed by
-- a nightly job (and on attendance/submission events) and read on every
-- admin heatmap cell - recomputing it per render would be N queries deep.

create table if not exists "public"."programme_cohort_members" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_id" "uuid" not null,
    "user_id" "uuid" not null,
    "team_lead_user_id" "uuid",
    "is_champion" boolean default false not null,
    "joined_at" timestamp with time zone default "now"() not null,
    "rag_status" "text",
    "rag_computed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notification_opt_out" boolean default false not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_cohort_members_rag_check" check (("rag_status" is null) or ("rag_status" = any (array[
        'green'::"text", 'amber'::"text", 'red'::"text"]))),
    -- Part 5's edge case, enforced in SQL rather than only in the action: a
    -- team lead who is themselves a cohort member must have their work
    -- routed to THEIR manager, never to themselves.
    constraint "programme_cohort_members_no_self_lead_check"
        check (("team_lead_user_id" is null) or ("team_lead_user_id" <> "user_id"))
);

alter table "public"."programme_cohort_members" owner to "postgres";

alter table only "public"."programme_cohort_members"
    add constraint "programme_cohort_members_pkey" primary key ("id");
alter table only "public"."programme_cohort_members"
    add constraint "programme_cohort_members_cohort_id_user_id_key" unique ("cohort_id", "user_id");
alter table only "public"."programme_cohort_members"
    add constraint "programme_cohort_members_cohort_id_fkey" foreign key ("cohort_id")
    references "public"."programme_cohorts"("id") on delete cascade;
alter table only "public"."programme_cohort_members"
    add constraint "programme_cohort_members_user_id_fkey" foreign key ("user_id")
    references "auth"."users"("id") on delete cascade;
alter table only "public"."programme_cohort_members"
    add constraint "programme_cohort_members_team_lead_user_id_fkey" foreign key ("team_lead_user_id")
    references "auth"."users"("id") on delete set null;

create index if not exists "programme_cohort_members_cohort_idx"
    on "public"."programme_cohort_members" using "btree" ("cohort_id");
create index if not exists "programme_cohort_members_user_idx"
    on "public"."programme_cohort_members" using "btree" ("user_id");
create index if not exists "programme_cohort_members_lead_idx"
    on "public"."programme_cohort_members" using "btree" ("team_lead_user_id");

-- "A user cannot be in two cohorts whose status is live/planned."
--
-- This CANNOT be a partial unique index: `status` lives on programme_cohorts,
-- not on the member row, and index predicates can't reference another table.
-- So it's a trigger. The Server Action checks it too (for a friendly error),
-- but the trigger is what makes it true.
create or replace function "public"."enforce_single_active_cohort"() returns "trigger"
    language "plpgsql"
    set "search_path" to 'public'
    as $$
declare
  v_conflict text;
begin
  select c.name into v_conflict
    from public.programme_cohort_members m
    join public.programme_cohorts c on c.id = m.cohort_id
   where m.user_id = new.user_id
     and m.id is distinct from new.id
     and c.status in ('planned', 'live')
   limit 1;

  if v_conflict is not null then
    -- Only block when the cohort being joined is itself active. Adding
    -- someone to an archived cohort for backfill is legitimate.
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
$$;

alter function "public"."enforce_single_active_cohort"() owner to "postgres";

create trigger "enforce_single_active_cohort_trigger"
    before insert or update of "user_id", "cohort_id" on "public"."programme_cohort_members"
    for each row execute function "public"."enforce_single_active_cohort"();

alter table "public"."programme_cohort_members" enable row level security;

-- Self-referential predicates only (no subquery into another RLS table), so
-- these are safe to inline without a SECURITY DEFINER helper.
create policy "read own or led programme_cohort_members" on "public"."programme_cohort_members"
    for select to "authenticated"
    using (("user_id" = "auth"."uid"()) or ("team_lead_user_id" = "auth"."uid"()) or "public"."is_super_admin"());
create policy "super_admin write programme_cohort_members" on "public"."programme_cohort_members"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_cohort_members" to "anon";
grant all on table "public"."programme_cohort_members" to "authenticated";
grant all on table "public"."programme_cohort_members" to "service_role";

-- Visibility helper for every child table. SECURITY DEFINER because the
-- policies below live on tables whose rows join through cohort_members, and
-- an inline subquery would re-apply cohort_members' own RLS.
create or replace function "public"."can_view_cohort_member"("p_cohort_member_id" "uuid") returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.programme_cohort_members m
     where m.id = p_cohort_member_id
       and (m.user_id = auth.uid() or m.team_lead_user_id = auth.uid())
  ) or public.is_super_admin();
$$;

alter function "public"."can_view_cohort_member"("uuid") owner to "postgres";

-- Narrower variant: "is this MY row" - used where a lead must not be able to
-- write on a member's behalf (progress, quiz attempts, submissions).
create or replace function "public"."owns_cohort_member"("p_cohort_member_id" "uuid") returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.programme_cohort_members m
     where m.id = p_cohort_member_id and m.user_id = auth.uid()
  );
$$;

alter function "public"."owns_cohort_member"("uuid") owner to "postgres";

-- "Do I lead this person in this cohort?" Attendance is keyed on (cohort,
-- user) rather than cohort_member_id, so it needs its own lead predicate.
create or replace function "public"."leads_user_in_cohort"("p_cohort_id" "uuid", "p_user_id" "uuid") returns boolean
    language "sql" stable security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.programme_cohort_members m
     where m.cohort_id = p_cohort_id
       and m.user_id = p_user_id
       and m.team_lead_user_id = auth.uid()
  );
$$;

alter function "public"."leads_user_in_cohort"("uuid", "uuid") owner to "postgres";

-- =========================================================================
-- programme_item_progress
-- =========================================================================
-- The durable, MONOTONIC record of what a member has finished.
--
-- Video items are the subtle case. `learn_video_completions` is a toggle -
-- unticking on /learn DELETES the row. If a gate read that table directly, an
-- untick would silently regress someone past G1. So: learn_video_completions
-- is an INPUT SIGNAL that can set progress, never clear it, and this table is
-- what gates and RAG actually read. The track never un-completes a row.

create table if not exists "public"."programme_item_progress" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_member_id" "uuid" not null,
    "track_item_id" "uuid" not null,
    "status" "text" default 'locked'::"text" not null,
    "completed_at" timestamp with time zone,
    "meta_json" "jsonb" default '{}'::"jsonb" not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_item_progress_status_check" check (("status" = any (array[
        'locked'::"text", 'available'::"text", 'started'::"text", 'complete'::"text"])))
);

alter table "public"."programme_item_progress" owner to "postgres";

alter table only "public"."programme_item_progress"
    add constraint "programme_item_progress_pkey" primary key ("id");
alter table only "public"."programme_item_progress"
    add constraint "programme_item_progress_member_item_key" unique ("cohort_member_id", "track_item_id");
alter table only "public"."programme_item_progress"
    add constraint "programme_item_progress_cohort_member_id_fkey" foreign key ("cohort_member_id")
    references "public"."programme_cohort_members"("id") on delete cascade;
alter table only "public"."programme_item_progress"
    add constraint "programme_item_progress_track_item_id_fkey" foreign key ("track_item_id")
    references "public"."programme_track_items"("id") on delete cascade;

create index if not exists "programme_item_progress_member_idx"
    on "public"."programme_item_progress" using "btree" ("cohort_member_id");

alter table "public"."programme_item_progress" enable row level security;

create policy "read own or led programme_item_progress" on "public"."programme_item_progress"
    for select to "authenticated" using ("public"."can_view_cohort_member"("cohort_member_id"));
-- Members write their own progress; a lead cannot mark work done for them.
create policy "write own programme_item_progress" on "public"."programme_item_progress"
    for insert to "authenticated" with check ("public"."owns_cohort_member"("cohort_member_id"));
create policy "update own programme_item_progress" on "public"."programme_item_progress"
    for update to "authenticated"
    using ("public"."owns_cohort_member"("cohort_member_id"))
    with check ("public"."owns_cohort_member"("cohort_member_id"));
create policy "super_admin write programme_item_progress" on "public"."programme_item_progress"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_item_progress" to "anon";
grant all on table "public"."programme_item_progress" to "authenticated";
grant all on table "public"."programme_item_progress" to "service_role";

-- =========================================================================
-- ai_score_responses  ("Your AI Score")
-- =========================================================================
-- Named for the product, not the playbook's `questionnaire_response`, because
-- the table is not programme-scoped: the may_2026 wave predates cohorts
-- entirely and day_90 postdates them.
--
-- KEYED ON EMAIL, NOT user_id. 108 people answered in May 2026; some have
-- never signed into AI Ops and so have no auth.users row. Dropping them would
-- shed exactly the sample the Part 7 organic-drift comparison depends on.
-- user_id is a nullable convenience FK backfilled at /auth/callback.
--
-- HARD RULE: every read, join, and grouping uses `email`. Nothing joins on
-- user_id - it stays null indefinitely for anyone holding a live session when
-- an import runs, and a same-people join on it would silently drop them.

create table if not exists "public"."ai_score_responses" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "email" "text" not null,
    "user_id" "uuid",
    "wave" "text" not null,
    "cohort_id" "uuid",
    "answers_json" "jsonb" default '{}'::"jsonb" not null,
    "source" "text" default 'in_app'::"text" not null,
    "flow" "text",
    -- Part 7 completion telemetry: median seconds per wave, split by flow.
    "duration_seconds" integer,
    "submitted_at" timestamp with time zone default "now"() not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "ai_score_responses_wave_check" check (("wave" = any (array[
        'may_2026'::"text", 'cohort_baseline'::"text", 'post'::"text", 'day_90'::"text"]))),
    constraint "ai_score_responses_source_check" check (("source" = any (array[
        'in_app'::"text", 'import'::"text"]))),
    constraint "ai_score_responses_flow_check" check (("flow" is null) or ("flow" = any (array[
        'returner'::"text", 'first_timer'::"text"]))),
    constraint "ai_score_responses_email_lowercase_check" check ("email" = lower("email"))
);

alter table "public"."ai_score_responses" owner to "postgres";

alter table only "public"."ai_score_responses"
    add constraint "ai_score_responses_pkey" primary key ("id");
-- The real idempotency key. The May import upserts on this.
alter table only "public"."ai_score_responses"
    add constraint "ai_score_responses_email_wave_key" unique ("email", "wave");
alter table only "public"."ai_score_responses"
    add constraint "ai_score_responses_user_id_fkey" foreign key ("user_id")
    references "auth"."users"("id") on delete set null;
alter table only "public"."ai_score_responses"
    add constraint "ai_score_responses_cohort_id_fkey" foreign key ("cohort_id")
    references "public"."programme_cohorts"("id") on delete set null;

-- Partial, because NULLs are distinct in a plain unique index - unmatched
-- rows would be free to duplicate.
create unique index if not exists "ai_score_responses_user_wave_key"
    on "public"."ai_score_responses" using "btree" ("user_id", "wave") where ("user_id" is not null);
create index if not exists "ai_score_responses_wave_idx"
    on "public"."ai_score_responses" using "btree" ("wave");

alter table "public"."ai_score_responses" enable row level security;

-- Self-read resolves through email, not auth.uid(), so a respondent whose
-- user_id hasn't been backfilled yet can still see their own May answers.
create policy "read own ai_score_responses" on "public"."ai_score_responses"
    for select to "authenticated"
    using ((lower("email") = "public"."current_user_email"()) or "public"."is_super_admin"());
create policy "insert own ai_score_responses" on "public"."ai_score_responses"
    for insert to "authenticated"
    with check (lower("email") = "public"."current_user_email"());
create policy "update own ai_score_responses" on "public"."ai_score_responses"
    for update to "authenticated"
    using (lower("email") = "public"."current_user_email"())
    with check (lower("email") = "public"."current_user_email"());
-- The May import writes rows owned by other people.
create policy "super_admin write ai_score_responses" on "public"."ai_score_responses"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."ai_score_responses" to "anon";
grant all on table "public"."ai_score_responses" to "authenticated";
grant all on table "public"."ai_score_responses" to "service_role";

-- =========================================================================
-- programme_submissions
-- =========================================================================

create table if not exists "public"."programme_submissions" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_member_id" "uuid" not null,
    "track_item_id" "uuid",
    "kind" "text" not null,
    "artefact_url" "text",
    "prompt_text" "text",
    "task_solved" "text",
    "time_saved_estimate" "text",
    "visibility" "text" default 'cohort'::"text" not null,
    "signoff_status" "text" default 'pending'::"text" not null,
    "signoff_rubric_json" "jsonb" default '{}'::"jsonb" not null,
    "signoff_comment" "text",
    "signed_by" "uuid",
    "signed_at" timestamp with time zone,
    -- Rejection history: a resubmission points back at the version it
    -- replaces, so prior attempts stay readable rather than being overwritten.
    "superseded_by" "uuid",
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_submissions_kind_check" check (("kind" = any (array[
        'signed_example'::"text", 'capstone'::"text", 'work_sample_pre'::"text",
        'work_sample_post'::"text", 'competition_entry'::"text"]))),
    constraint "programme_submissions_visibility_check" check (("visibility" = any (array[
        'public_gallery'::"text", 'cohort'::"text", 'private'::"text"]))),
    constraint "programme_submissions_signoff_status_check" check (("signoff_status" = any (array[
        'pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    -- Work samples feed external blind scoring and are never shown to peers.
    constraint "programme_submissions_work_sample_private_check" check (
        ("kind" not in ('work_sample_pre', 'work_sample_post')) or ("visibility" = 'private'))
);

alter table "public"."programme_submissions" owner to "postgres";

alter table only "public"."programme_submissions"
    add constraint "programme_submissions_pkey" primary key ("id");
alter table only "public"."programme_submissions"
    add constraint "programme_submissions_cohort_member_id_fkey" foreign key ("cohort_member_id")
    references "public"."programme_cohort_members"("id") on delete cascade;
alter table only "public"."programme_submissions"
    add constraint "programme_submissions_track_item_id_fkey" foreign key ("track_item_id")
    references "public"."programme_track_items"("id") on delete set null;
alter table only "public"."programme_submissions"
    add constraint "programme_submissions_signed_by_fkey" foreign key ("signed_by")
    references "auth"."users"("id") on delete set null;
alter table only "public"."programme_submissions"
    add constraint "programme_submissions_superseded_by_fkey" foreign key ("superseded_by")
    references "public"."programme_submissions"("id") on delete set null;

create index if not exists "programme_submissions_member_idx"
    on "public"."programme_submissions" using "btree" ("cohort_member_id");
create index if not exists "programme_submissions_gallery_idx"
    on "public"."programme_submissions" using "btree" ("signoff_status", "visibility");

alter table "public"."programme_submissions" enable row level security;

-- Three read paths, in order of breadth:
--   1. the gallery - approved AND public_gallery, visible company-wide;
--   2. own rows and rows you're the lead for - but never someone else's
--      private work samples, which only admins see;
--   3. super_admin.
create policy "read gallery programme_submissions" on "public"."programme_submissions"
    for select to "authenticated"
    using (("signoff_status" = 'approved') and ("visibility" = 'public_gallery'));
create policy "read own programme_submissions" on "public"."programme_submissions"
    for select to "authenticated" using ("public"."owns_cohort_member"("cohort_member_id"));
create policy "read led programme_submissions" on "public"."programme_submissions"
    for select to "authenticated"
    using (("visibility" <> 'private') and "public"."can_view_cohort_member"("cohort_member_id"));
create policy "super_admin read programme_submissions" on "public"."programme_submissions"
    for select to "authenticated" using ("public"."is_super_admin"());

-- Members create and edit their own; sign-off is NOT a table grant - it goes
-- through the programme_sign_off RPC in Part 5, which validates the lead
-- relationship. Without that split a member could approve their own work by
-- writing signoff_status directly.
create policy "insert own programme_submissions" on "public"."programme_submissions"
    for insert to "authenticated" with check ("public"."owns_cohort_member"("cohort_member_id"));
create policy "update own pending programme_submissions" on "public"."programme_submissions"
    for update to "authenticated"
    using ("public"."owns_cohort_member"("cohort_member_id") and ("signoff_status" <> 'approved'))
    with check ("public"."owns_cohort_member"("cohort_member_id") and ("signoff_status" <> 'approved'));
create policy "super_admin write programme_submissions" on "public"."programme_submissions"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_submissions" to "anon";
grant all on table "public"."programme_submissions" to "authenticated";
grant all on table "public"."programme_submissions" to "service_role";

-- =========================================================================
-- programme_quiz_attempts
-- =========================================================================
-- Every attempt is kept; the UI surfaces the best. Retakes are unlimited and
-- must never lower a recorded score, which "keep all, read max" gives free.

create table if not exists "public"."programme_quiz_attempts" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_member_id" "uuid" not null,
    "track_item_id" "uuid" not null,
    "score" integer not null,
    "answers_json" "jsonb" default '{}'::"jsonb" not null,
    "created_at" timestamp with time zone default "now"() not null,
    constraint "programme_quiz_attempts_score_check" check (("score" >= 0))
);

alter table "public"."programme_quiz_attempts" owner to "postgres";

alter table only "public"."programme_quiz_attempts"
    add constraint "programme_quiz_attempts_pkey" primary key ("id");
alter table only "public"."programme_quiz_attempts"
    add constraint "programme_quiz_attempts_cohort_member_id_fkey" foreign key ("cohort_member_id")
    references "public"."programme_cohort_members"("id") on delete cascade;
alter table only "public"."programme_quiz_attempts"
    add constraint "programme_quiz_attempts_track_item_id_fkey" foreign key ("track_item_id")
    references "public"."programme_track_items"("id") on delete cascade;

create index if not exists "programme_quiz_attempts_member_item_idx"
    on "public"."programme_quiz_attempts" using "btree" ("cohort_member_id", "track_item_id");

alter table "public"."programme_quiz_attempts" enable row level security;

create policy "read own or led programme_quiz_attempts" on "public"."programme_quiz_attempts"
    for select to "authenticated" using ("public"."can_view_cohort_member"("cohort_member_id"));
create policy "insert own programme_quiz_attempts" on "public"."programme_quiz_attempts"
    for insert to "authenticated" with check ("public"."owns_cohort_member"("cohort_member_id"));
create policy "super_admin write programme_quiz_attempts" on "public"."programme_quiz_attempts"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_quiz_attempts" to "anon";
grant all on table "public"."programme_quiz_attempts" to "authenticated";
grant all on table "public"."programme_quiz_attempts" to "service_role";

-- =========================================================================
-- programme_session_attendance
-- =========================================================================
-- Keyed on user_id rather than cohort_member_id because attendance is marked
-- against a roster grid of people, and an excused member may satisfy G2 via
-- meta_json.make_up = true (they attended the equivalent session in another
-- cohort).

create table if not exists "public"."programme_session_attendance" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_id" "uuid" not null,
    "track_item_id" "uuid" not null,
    "user_id" "uuid" not null,
    "status" "text" not null,
    -- Which of a dual-slot session's two dates they attended. Null for
    -- single-slot sessions; attending either slot satisfies the item.
    "slot" integer,
    "marked_by" "uuid",
    "meta_json" "jsonb" default '{}'::"jsonb" not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "programme_session_attendance_status_check" check (("status" = any (array[
        'attended'::"text", 'absent'::"text", 'excused'::"text"])))
);

alter table "public"."programme_session_attendance" owner to "postgres";

alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_pkey" primary key ("id");
alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_cohort_item_user_key" unique ("cohort_id", "track_item_id", "user_id");
alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_cohort_id_fkey" foreign key ("cohort_id")
    references "public"."programme_cohorts"("id") on delete cascade;
alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_track_item_id_fkey" foreign key ("track_item_id")
    references "public"."programme_track_items"("id") on delete cascade;
alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_user_id_fkey" foreign key ("user_id")
    references "auth"."users"("id") on delete cascade;
alter table only "public"."programme_session_attendance"
    add constraint "programme_session_attendance_marked_by_fkey" foreign key ("marked_by")
    references "auth"."users"("id") on delete set null;

create index if not exists "programme_session_attendance_cohort_idx"
    on "public"."programme_session_attendance" using "btree" ("cohort_id", "track_item_id");

alter table "public"."programme_session_attendance" enable row level security;

-- Own rows, or rows for anyone you lead in that cohort. The lead check goes
-- through cohort_members, so it needs the SECURITY DEFINER helper.
create policy "read own or led programme_session_attendance" on "public"."programme_session_attendance"
    for select to "authenticated"
    using (("user_id" = "auth"."uid"())
        or "public"."is_super_admin"()
        or "public"."leads_user_in_cohort"("cohort_id", "user_id"));
-- Roster marking is an admin action.
create policy "super_admin write programme_session_attendance" on "public"."programme_session_attendance"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_session_attendance" to "anon";
grant all on table "public"."programme_session_attendance" to "authenticated";
grant all on table "public"."programme_session_attendance" to "service_role";

-- =========================================================================
-- updated_at maintenance
-- =========================================================================
-- Every programme table carries updated_at; nothing sets it without a
-- trigger. One shared function rather than the per-table variant the baseline
-- uses (tg_intervention_suggestions_touch) - there are eight tables here.

create or replace function "public"."tg_programme_touch"() returns "trigger"
    language "plpgsql"
    as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function "public"."tg_programme_touch"() owner to "postgres";

create trigger "tg_programme_tracks_touch" before update on "public"."programme_tracks"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_track_items_touch" before update on "public"."programme_track_items"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_cohorts_touch" before update on "public"."programme_cohorts"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_cohort_members_touch" before update on "public"."programme_cohort_members"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_item_progress_touch" before update on "public"."programme_item_progress"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_ai_score_responses_touch" before update on "public"."ai_score_responses"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_submissions_touch" before update on "public"."programme_submissions"
    for each row execute function "public"."tg_programme_touch"();
create trigger "tg_programme_session_attendance_touch" before update on "public"."programme_session_attendance"
    for each row execute function "public"."tg_programme_touch"();

-- =========================================================================
-- Company average for the "Your AI Score" result screen
-- =========================================================================
-- Aggregate ONLY. The result screen shows "Phlo average today: x.x" and must
-- never be able to percentile-rank an individual, so this returns a single
-- number and suppresses it below a minimum sample size. SECURITY DEFINER
-- because a member cannot read other people's response rows.

create or replace function "public"."ai_score_company_average"() returns numeric
    language "plpgsql" stable security definer
    set "search_path" to 'public', 'auth'
    as $$
declare
  v_avg numeric;
  v_n integer;
begin
  -- Latest wave per person, capability questions q1-q7 only.
  -- answers_json stores {"q1": {"value": ..., "score": 0-4}, ...}.
  --
  -- Test cohorts are excluded BY PERSON, not by the response's cohort_id.
  -- Filtering on r.cohort_id would miss them: may_2026 rows carry a null
  -- cohort_id by design (they predate cohorts), so a fixture member's answers
  -- would pass the filter and skew a seeded dev database's average.
  with excluded_emails as (
    select lower(u.email) as email
      from public.programme_cohort_members m
      join public.programme_cohorts c on c.id = m.cohort_id
      join auth.users u on u.id = m.user_id
     where c.is_test
  ), latest as (
    select distinct on (r.email) r.answers_json
      from public.ai_score_responses r
     where lower(r.email) not in (select email from excluded_emails)
     order by r.email, r.submitted_at desc
  ), scored as (
    select (
      select avg((v ->> 'score')::numeric)
        from jsonb_each(l.answers_json) as e(k, v)
       where k in ('q1','q2','q3','q4','q5','q6','q7')
         and (v ->> 'score') is not null
    ) as cap_avg
    from latest l
  )
  select avg(cap_avg), count(*) into v_avg, v_n from scored where cap_avg is not null;

  -- Below this, an "average" is close enough to naming individuals.
  if v_n < 5 then
    return null;
  end if;
  return round(v_avg, 1);
end;
$$;

alter function "public"."ai_score_company_average"() owner to "postgres";

revoke all on function "public"."ai_score_company_average"() from "public";
grant execute on function "public"."ai_score_company_average"() to "authenticated";
grant execute on function "public"."ai_score_company_average"() to "service_role";
