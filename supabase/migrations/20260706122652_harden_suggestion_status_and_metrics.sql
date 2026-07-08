-- Two DB-level authorization fixes that the app enforced only in Server
-- Actions, and were therefore bypassable by calling PostgREST directly with
-- the public publishable key + a valid user JWT.

-- 1) Champion status-transition guardrail --------------------------------------
--
-- setSuggestionStatus() restricts team champions to moving a suggestion to
-- 'under_review' or 'declined'; only super-admins may 'accept' or 'ship'
-- (the guardrail against non-technical approval of unfeasible asks). But the
-- RLS policy `suggestions_update_priv` lets any champion of the suggestion's
-- team UPDATE the row with no restriction on the resulting status, so a
-- champion could set status='accepted'/'shipped' directly via PostgREST.
--
-- This trigger enforces the same rule at the DB layer, on both INSERT and
-- UPDATE:
--   * INSERT: a non-super-admin may only create a suggestion in the 'open'
--     state. Without this, a member could POST a row with status='shipped'
--     directly (the `suggestions_insert_own` policy only checks created_by),
--     bypassing the guardrail entirely. createSuggestion relies on the column
--     default ('open'), so the legitimate path is unaffected.
--   * UPDATE: only acts when the status column actually changes, so edits to
--     other columns (decline_reason, title, body, intervention_id) are
--     unaffected. RLS already blocks every role except super-admin and
--     team-champion from changing status at all (the creator branch only
--     permits updates while status='open', and its WITH CHECK rejects any move
--     off 'open'), so the only actor this constrains on UPDATE is a champion.
create or replace function "public"."enforce_suggestion_status_transition"()
    returns "trigger"
    language "plpgsql"
    security definer
    set "search_path" to 'public'
    as $$
begin
  -- No end-user identity on the request (service_role, migration, direct
  -- postgres) -> trust it.
  if auth.uid() is null then
    return new;
  end if;

  -- Super-admins may set any status via any operation.
  if exists (
    select 1 from public.role_grants g
    where g.user_id = auth.uid() and g.role = 'super_admin'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Non-super-admins can only create suggestions in the 'open' state.
    if new.status is distinct from 'open' then
      raise exception 'New suggestions must start as open, not %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: only constrain actual status changes.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Everyone else (in practice, only team champions reach here) may triage to
  -- 'under_review' or 'declined' only. Mirrors CHAMPION_TARGETS in
  -- app/(protected)/suggestions/actions.ts.
  if new.status not in ('under_review', 'declined') then
    raise exception 'Only a super admin can set suggestion status to %', new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function "public"."enforce_suggestion_status_transition"() owner to "postgres";

drop trigger if exists "enforce_suggestion_status_transition"
  on "public"."intervention_suggestions";

create trigger "enforce_suggestion_status_transition"
    before insert or update on "public"."intervention_suggestions"
    for each row execute function "public"."enforce_suggestion_status_transition"();

-- 2) intervention_metrics insert requires edit rights --------------------------
--
-- The old policy only required `created_by = auth.uid()`, so any authenticated
-- member could log metric snapshots against any initiative (skewing dashboard
-- savings aggregates), even ones they don't own or champion. Bring it in line
-- with the UPDATE policy on ai_interventions, which gates on
-- can_edit_intervention() (super-admin OR creator OR champion of a linked
-- workflow's team).
drop policy if exists "auth insert intervention_metrics"
  on "public"."intervention_metrics";

create policy "auth insert intervention_metrics"
  on "public"."intervention_metrics"
  for insert to "authenticated"
  with check (
    ("created_by" = "auth"."uid"())
    and "public"."can_edit_intervention"("intervention_id")
  );
