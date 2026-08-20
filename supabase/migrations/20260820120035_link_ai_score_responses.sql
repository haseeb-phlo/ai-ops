-- Binds ai_score_responses rows to auth.users once an account exists.
--
-- Responses are keyed on email because the May 2026 wave predates cohorts and
-- some respondents have never signed into AI Ops at all. user_id is a
-- convenience FK, filled in whenever we can - never something a query joins on.
--
-- Called from two places:
--   * app/auth/callback/route.ts, on every sign-in, so a first-time signer-in
--     picks up their May baseline immediately;
--   * the May import, so anyone who already has an account is linked at once.
--
-- SECURITY DEFINER because it reads auth.users, but it cannot mislink: the
-- only rows it touches are ones whose stored email already equals the account
-- email, and it never overwrites an existing user_id.

create or replace function "public"."link_ai_score_responses"() returns integer
    language "plpgsql" security definer
    set "search_path" to 'public', 'auth'
    as $$
declare
  v_linked integer;
begin
  with linked as (
    update public.ai_score_responses r
       set user_id = u.id
      from auth.users u
     where r.user_id is null
       and lower(u.email) = r.email
    returning 1
  )
  select count(*) into v_linked from linked;
  return coalesce(v_linked, 0);
end;
$$;

alter function "public"."link_ai_score_responses"() owner to "postgres";

revoke all on function "public"."link_ai_score_responses"() from "public";
grant execute on function "public"."link_ai_score_responses"() to "authenticated";
grant execute on function "public"."link_ai_score_responses"() to "service_role";

-- The email lookup runs on every sign-in, so give it an index.
create index if not exists "ai_score_responses_unlinked_email_idx"
    on "public"."ai_score_responses" using "btree" ("email") where ("user_id" is null);
