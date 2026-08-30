-- Admin enrolment: putting a roster INTO a cohort.
--
-- Until now there were exactly two ways to become a cohort member, and an
-- admin controlled neither: `join_programme_cohort`, which the person runs on
-- themselves with a code, and `programme_start_preview_run`, which enrols the
-- admin in their own sandbox. The roster tab's own empty state said "Add
-- people to the cohort to mark their attendance" next to no way of doing it.
--
-- The complication is that a cohort roster is a list of EMAILS, and an email
-- is not a user. Of 138 people in `people`, 75 have ever signed in; the other
-- 63 have no `auth.users` row, so there is no `user_id` to write a membership
-- against. Waiting for them to sign in first, then enrolling by hand, is how a
-- launch day is spent chasing individuals.
--
-- So enrolment is recorded at whichever level is available. Somebody with an
-- account becomes a member immediately. Somebody without one gets a PENDING
-- row here, which turns into a membership the first time they sign in - the
-- same shape, and the same sign-in hook, that `link_ai_score_responses`
-- already uses to bind May's responses to late arrivals.

create table if not exists "public"."programme_pending_enrolments" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "cohort_id" "uuid" not null,
    -- Lowercased on the way in; the check makes that an invariant rather than
    -- a convention, because the claim lookup compares against lower(email).
    "email" "text" not null,
    "team_lead_user_id" "uuid",
    "added_by" "uuid",
    "created_at" timestamp with time zone default "now"() not null,
    "claimed_at" timestamp with time zone,
    "claimed_member_id" "uuid"
);

alter table "public"."programme_pending_enrolments" owner to "postgres";

alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_pkey" primary key ("id");

alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_email_lower_check"
    check ("email" = "lower"("email"));

-- One pending row per person per cohort. Re-running an enrolment is therefore
-- idempotent rather than duplicating the roster.
alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_cohort_email_key"
    unique ("cohort_id", "email");

alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_cohort_id_fkey"
    foreign key ("cohort_id") references "public"."programme_cohorts"("id") on delete cascade;

alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_team_lead_user_id_fkey"
    foreign key ("team_lead_user_id") references "auth"."users"("id") on delete set null;

alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_added_by_fkey"
    foreign key ("added_by") references "auth"."users"("id") on delete set null;

-- The membership this row turned into, kept so an admin can see that a
-- pending enrolment was honoured rather than quietly dropped.
alter table only "public"."programme_pending_enrolments"
    add constraint "programme_pending_enrolments_claimed_member_id_fkey"
    foreign key ("claimed_member_id") references "public"."programme_cohort_members"("id") on delete set null;

-- Runs on every sign-in, so it is a partial index on exactly the rows the
-- lookup can still match.
create index if not exists "programme_pending_enrolments_unclaimed_email_idx"
    on "public"."programme_pending_enrolments" using "btree" ("email")
    where ("claimed_at" is null);

alter table "public"."programme_pending_enrolments" enable row level security;

-- Admin-only, both directions. A member never needs to read this: by the time
-- it would tell them anything, they are a member and the row is claimed.
create policy "super_admin all programme_pending_enrolments"
    on "public"."programme_pending_enrolments"
    for all to "authenticated"
    using ("public"."is_super_admin"()) with check ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_pending_enrolments" to "anon";
grant all on table "public"."programme_pending_enrolments" to "authenticated";
grant all on table "public"."programme_pending_enrolments" to "service_role";

-- =========================================================================
-- Claiming
-- =========================================================================
-- Called from app/auth/callback/route.ts on every sign-in, beside
-- link_ai_score_responses. SECURITY DEFINER because it reads auth.users and
-- writes a membership the signing-in person has no RLS policy to write for
-- themselves - but it can only ever act on rows whose stored email already
-- equals the account's own, and only for the caller's own auth.uid().
--
-- It must never raise. A sign-in that fails because of a training enrolment
-- is a far worse outcome than an enrolment that waits until tomorrow, so the
-- two situations that could throw are both checked and skipped:
--
--   * already a member of that cohort - someone who used the join code in the
--     meantime. The pending row is closed, not duplicated.
--   * already in a DIFFERENT active cohort - `enforce_single_active_cohort`
--     would raise 23505 here. The row is left pending instead, so it resolves
--     itself once that other cohort completes, with no admin action.

create or replace function "public"."programme_claim_pending_enrolments"() returns integer
    language "plpgsql" security definer
    set "search_path" to 'public', 'auth'
    as $fn$
declare
  v_email text;
  v_claimed integer := 0;
  v_member_id uuid;
  r record;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return 0;
  end if;

  for r in
    select p.id, p.cohort_id, p.team_lead_user_id
      from public.programme_pending_enrolments p
      join public.programme_cohorts c on c.id = p.cohort_id
     where p.claimed_at is null
       and p.email = v_email
       and c.status in ('planned', 'live')
     order by p.created_at
  loop
    if exists (
      select 1 from public.programme_cohort_members m
       where m.cohort_id = r.cohort_id and m.user_id = auth.uid()
    ) then
      update public.programme_pending_enrolments
         set claimed_at = now()
       where id = r.id;
      continue;
    end if;

    if exists (
      select 1
        from public.programme_cohort_members m
        join public.programme_cohorts c2 on c2.id = m.cohort_id
       where m.user_id = auth.uid()
         and c2.status in ('planned', 'live')
    ) then
      continue;
    end if;

    insert into public.programme_cohort_members (cohort_id, user_id, team_lead_user_id)
    values (
      r.cohort_id,
      auth.uid(),
      -- Never let the roster make somebody their own approver.
      case when r.team_lead_user_id = auth.uid() then null else r.team_lead_user_id end
    )
    returning id into v_member_id;

    update public.programme_pending_enrolments
       set claimed_at = now(), claimed_member_id = v_member_id
     where id = r.id;

    v_claimed := v_claimed + 1;
  end loop;

  return v_claimed;
end;
$fn$;

alter function "public"."programme_claim_pending_enrolments"() owner to "postgres";

revoke all on function "public"."programme_claim_pending_enrolments"() from "public";
grant execute on function "public"."programme_claim_pending_enrolments"() to "authenticated";
grant execute on function "public"."programme_claim_pending_enrolments"() to "service_role";

comment on function "public"."programme_claim_pending_enrolments"() is
  'Turns this account''s pending cohort enrolments into memberships. Called on every sign-in; never raises, so a training enrolment can never block auth.';
