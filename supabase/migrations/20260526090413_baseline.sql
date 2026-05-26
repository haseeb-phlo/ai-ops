


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."can_delete_workflow"("p_workflow_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (select exists (
       select 1 from public.role_grants g
       where g.user_id = auth.uid()
         and g.role = 'super_admin'
     )),
    false
  )
  or coalesce(
    (select w.created_by = auth.uid()
       from public.workflows w
      where w.id = p_workflow_id),
    false
  )
  or coalesce(
    (select exists (
       select 1
         from public.workflows w
         join public.champions c
           on c.team = w.team
          and c.user_id = auth.uid()
        where w.id = p_workflow_id
     )),
    false
  )
  or public.is_workflow_name_owner(p_workflow_id);
$$;


ALTER FUNCTION "public"."can_delete_workflow"("p_workflow_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_intervention"("p_intervention_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.ai_interventions i
      where i.id = p_intervention_id and i.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.intervention_workflows iw
      join public.workflows w on w.id = iw.workflow_id
      join public.champions c  on c.team = w.team
      where iw.intervention_id = p_intervention_id
        and c.user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."can_edit_intervention"("p_intervention_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_intervention"("p_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_is_super boolean;
  v_deleted_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.role_grants g
    where g.user_id = v_user_id and g.role = 'super_admin'
  ) into v_is_super;

  if not v_is_super then
    raise exception 'Only super_admin can delete interventions'
      using errcode = '42501';
  end if;

  -- Detach suggestions before the cascade fires so a suggestion that
  -- pointed here flips back to open instead of being stuck on a deleted
  -- intervention.
  update public.intervention_suggestions
     set intervention_id = null,
         status = 'open'
   where intervention_id = p_id;

  delete from public.ai_interventions
   where id = p_id
   returning id into v_deleted_id;

  return v_deleted_id;
end;
$$;


ALTER FUNCTION "public"."delete_intervention"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_phlo_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
begin
  if new.email is null or new.email !~* '@wearephlo\.com$' then
    raise exception 'Sign-up restricted to @wearephlo.com email addresses'
      using errcode = '22023';
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."enforce_phlo_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.role_grants (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workflow_name_owner"("p_workflow_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_owner_names text[];
  v_email       text;
  v_match       boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select w.owner_names into v_owner_names
    from public.workflows w
   where w.id = p_workflow_id;

  if v_owner_names is null or array_length(v_owner_names, 1) is null then
    return false;
  end if;

  select au.email into v_email
    from auth.users au
   where au.id = auth.uid();

  if v_email is null or v_email = '' then
    return false;
  end if;

  with names as (
    select lower(trim(p.display_name)) as n
      from public.profiles p
     where p.user_id = auth.uid()
       and p.display_name is not null
    union
    select lower(trim(pe.display_name))
      from public.people pe
     where lower(pe.email) = lower(v_email)
       and pe.display_name is not null
    union
    select lower(trim(v_email))
    union
    select lower(trim(split_part(v_email, '@', 1)))
  ),
  candidates as (
    select n from names where n is not null and n <> ''
  )
  select exists (
    select 1
      from unnest(v_owner_names) as o(name)
      join candidates c on c.n = lower(trim(o.name))
  ) into v_match;

  return coalesce(v_match, false);
end;
$$;


ALTER FUNCTION "public"."is_workflow_name_owner"("p_workflow_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_intervention"("p_name" "text", "p_types" "text"[], "p_workflow_ids" "uuid"[], "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_description" "text" DEFAULT NULL::"text", "p_attribution_confidence" "text" DEFAULT 'medium'::"text", "p_adoption_status" "text" DEFAULT NULL::"text", "p_satisfaction" smallint DEFAULT NULL::smallint, "p_recipient_emails" "text"[] DEFAULT '{}'::"text"[], "p_tools_used" "text"[] DEFAULT '{}'::"text"[], "p_frequency_cadence" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id         uuid := auth.uid();
  v_owner           text;
  v_intervention_id uuid;
  v_workflow_id     uuid;
  v_metrics         public.workflow_metrics%rowtype;
  v_recipients      text[];
  v_tools           text[];
  v_types           text[];
  v_uses            numeric := coalesce(p_uses_per_week, 0);
  v_min_per_use     numeric := coalesce(p_minutes_saved_per_use, 0);
  v_cost_per_use    numeric := coalesce(p_cost_saved_per_use, 0);
  v_rev_per_use     numeric := coalesce(p_revenue_per_use, 0);
  v_cadence         text    := nullif(p_frequency_cadence, '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_workflow_ids is null or array_length(p_workflow_ids, 1) is null then
    raise exception 'At least one workflow is required' using errcode = '22023';
  end if;

  if p_types is null or array_length(p_types, 1) is null then
    raise exception 'At least one type is required' using errcode = '22023';
  end if;

  if p_uses_per_week is null or p_uses_per_week < 0 then
    raise exception 'Times per week is required and must be >= 0' using errcode = '22023';
  end if;

  if v_cadence is not null
     and v_cadence not in ('daily','weekly','fortnightly','monthly') then
    raise exception 'Invalid frequency_cadence: %', v_cadence using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct t), '{}')
    into v_types
    from unnest(p_types) as t
   where t in ('tool','training','prompt','agent','automation','process_change');

  if array_length(v_types, 1) is null then
    raise exception 'No valid intervention types in %', p_types using errcode = '22023';
  end if;

  if p_attribution_confidence not in ('high','medium','low') then
    raise exception 'Invalid attribution_confidence: %', p_attribution_confidence
      using errcode = '22023';
  end if;

  if p_adoption_status is not null
     and p_adoption_status not in ('daily','weekly','occasional','abandoned') then
    raise exception 'Invalid adoption_status: %', p_adoption_status
      using errcode = '22023';
  end if;

  if p_satisfaction is not null and (p_satisfaction < 1 or p_satisfaction > 5) then
    raise exception 'satisfaction must be between 1 and 5'
      using errcode = '22023';
  end if;

  if p_recipient_emails is null then
    v_recipients := '{}';
  else
    select coalesce(array_agg(distinct lower(trim(e))), '{}')
      into v_recipients
      from unnest(p_recipient_emails) as e
     where e is not null
       and length(trim(e)) > 0
       and exists (
         select 1 from public.people p
          where lower(p.email) = lower(trim(e))
       );
  end if;

  if p_tools_used is null then
    v_tools := '{}';
  else
    select coalesce(array_agg(distinct trim(t)), '{}')
      into v_tools
      from unnest(p_tools_used) as t
     where t is not null
       and length(trim(t)) > 0;
  end if;

  v_owner := auth.jwt() ->> 'email';

  insert into public.ai_interventions
        (name, types, description, status, owner,
         uses_per_week, minutes_saved_per_use,
         cost_saved_per_use, revenue_per_use,
         minutes_saved_per_week,
         estimated_gbp_saved_per_week, estimated_revenue_per_week,
         attribution_confidence,
         adoption_status, satisfaction,
         recipient_emails, tools_used,
         frequency_cadence,
         created_by)
  values (p_name, v_types, p_description, 'active', v_owner,
          v_uses, v_min_per_use,
          v_cost_per_use, v_rev_per_use,
          v_min_per_use * v_uses,
          v_cost_per_use * v_uses, v_rev_per_use * v_uses,
          p_attribution_confidence,
          p_adoption_status, p_satisfaction,
          v_recipients, v_tools,
          v_cadence,
          v_user_id)
  returning id into v_intervention_id;

  foreach v_workflow_id in array p_workflow_ids
  loop
    insert into public.intervention_workflows (intervention_id, workflow_id)
    values (v_intervention_id, v_workflow_id)
    on conflict do nothing;

    select * into v_metrics
      from public.workflow_metrics
     where workflow_id = v_workflow_id;

    insert into public.workflow_baselines
          (workflow_id, intervention_id,
           time_value, cost_value, people_value, errors_value, revenue_value)
    values (v_workflow_id, v_intervention_id,
            coalesce(v_metrics.time_current,    v_metrics.time_baseline,    0),
            coalesce(v_metrics.cost_current,    v_metrics.cost_baseline,    0),
            coalesce(v_metrics.people_current,  v_metrics.people_baseline,  0),
            coalesce(v_metrics.errors_current,  v_metrics.errors_baseline,  0),
            coalesce(v_metrics.revenue_current, v_metrics.revenue_baseline, 0));
  end loop;

  insert into public.intervention_metrics
        (intervention_id, snapshot_date,
         adoption_status, satisfaction,
         created_by)
  values (v_intervention_id, current_date,
          p_adoption_status, p_satisfaction,
          v_user_id);

  return v_intervention_id;
end;
$$;


ALTER FUNCTION "public"."log_intervention"("p_name" "text", "p_types" "text"[], "p_workflow_ids" "uuid"[], "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_description" "text", "p_attribution_confidence" "text", "p_adoption_status" "text", "p_satisfaction" smallint, "p_recipient_emails" "text"[], "p_tools_used" "text"[], "p_frequency_cadence" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_logins"() RETURNS TABLE("email" "text", "last_sign_in_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if not exists (
    select 1 from public.role_grants
      where user_id = auth.uid() and role = 'super_admin'
  ) then
    raise exception 'Super-admin only' using errcode = '42501';
  end if;

  return query
    select lower(u.email) as email,
           u.last_sign_in_at,
           u.created_at
      from auth.users u
     where u.email is not null
     order by u.last_sign_in_at desc nulls last;
end;
$$;


ALTER FUNCTION "public"."recent_logins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_intervention_status"("p_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_email   text := auth.jwt() ->> 'email';
  v_old     text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.can_edit_intervention(p_id) then
    raise exception 'Not allowed to edit this intervention' using errcode = '42501';
  end if;

  if p_status not in ('active','paused','retired') then
    raise exception 'Invalid status: %', p_status using errcode = '22023';
  end if;

  select status into v_old from public.ai_interventions where id = p_id;
  if not found then
    raise exception 'Intervention not found' using errcode = 'P0002';
  end if;

  if v_old is distinct from p_status then
    update public.ai_interventions set status = p_status where id = p_id;

    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values
      (p_id, v_user_id, v_email, 'status_change', 'status', v_old, p_status);
  end if;
end;
$$;


ALTER FUNCTION "public"."set_intervention_status"("p_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."signed_in_emails"() RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  result text[];
begin
  select coalesce(array_agg(lower(email)), '{}'::text[])
    into result
    from auth.users
   where email is not null
     and last_sign_in_at is not null;
  return result;
end;
$$;


ALTER FUNCTION "public"."signed_in_emails"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."swap_step_positions"("p_step_a" "uuid", "p_step_b" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  a_pos integer;
  b_pos integer;
  a_workflow uuid;
  b_workflow uuid;
begin
  select position, workflow_id
    into a_pos, a_workflow
    from public.workflow_steps
   where id = p_step_a;
  select position, workflow_id
    into b_pos, b_workflow
    from public.workflow_steps
   where id = p_step_b;

  if a_pos is null or b_pos is null then
    raise exception 'swap_step_positions: step not found';
  end if;
  if a_workflow is null
     or b_workflow is null
     or a_workflow <> b_workflow then
    raise exception 'swap_step_positions: steps belong to different workflows';
  end if;

  update public.workflow_steps set position = b_pos where id = p_step_a;
  update public.workflow_steps set position = a_pos where id = p_step_b;
end;
$$;


ALTER FUNCTION "public"."swap_step_positions"("p_step_a" "uuid", "p_step_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_intervention_suggestions_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_intervention_suggestions_touch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intervention"("p_id" "uuid", "p_name" "text", "p_types" "text"[], "p_description" "text", "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_attribution_confidence" "text", "p_adoption_status" "text" DEFAULT NULL::"text", "p_satisfaction" smallint DEFAULT NULL::smallint, "p_frequency_cadence" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_email   text := auth.jwt() ->> 'email';
  v_old     public.ai_interventions%rowtype;
  v_types   text[];
  v_uses    numeric := coalesce(p_uses_per_week, 0);
  v_min_pu  numeric := coalesce(p_minutes_saved_per_use, 0);
  v_cost_pu numeric := coalesce(p_cost_saved_per_use, 0);
  v_rev_pu  numeric := coalesce(p_revenue_per_use, 0);
  v_cadence text    := nullif(p_frequency_cadence, '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.can_edit_intervention(p_id) then
    raise exception 'Not allowed to edit this intervention' using errcode = '42501';
  end if;

  if length(coalesce(p_name, '')) = 0 then
    raise exception 'Name is required' using errcode = '22023';
  end if;

  if p_types is null or array_length(p_types, 1) is null then
    raise exception 'At least one type is required' using errcode = '22023';
  end if;

  if p_uses_per_week is null or p_uses_per_week < 0 then
    raise exception 'Times per week is required and must be >= 0' using errcode = '22023';
  end if;

  if v_cadence is not null
     and v_cadence not in ('daily','weekly','fortnightly','monthly') then
    raise exception 'Invalid frequency_cadence: %', v_cadence using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct t), '{}')
    into v_types
    from unnest(p_types) as t
   where t in ('tool','training','prompt','agent','automation','process_change');

  if array_length(v_types, 1) is null then
    raise exception 'No valid intervention types in %', p_types using errcode = '22023';
  end if;

  if p_attribution_confidence not in ('high','medium','low') then
    raise exception 'Invalid attribution_confidence: %', p_attribution_confidence
      using errcode = '22023';
  end if;

  if p_adoption_status is not null
     and p_adoption_status not in ('daily','weekly','occasional','abandoned') then
    raise exception 'Invalid adoption_status: %', p_adoption_status
      using errcode = '22023';
  end if;

  if p_satisfaction is not null and (p_satisfaction < 1 or p_satisfaction > 5) then
    raise exception 'satisfaction must be between 1 and 5'
      using errcode = '22023';
  end if;

  select * into v_old from public.ai_interventions where id = p_id;
  if not found then
    raise exception 'Intervention not found' using errcode = 'P0002';
  end if;

  if v_old.name is distinct from p_name then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'name', v_old.name, p_name);
  end if;

  if v_old.types is distinct from v_types then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'types',
            array_to_string(v_old.types, ', '),
            array_to_string(v_types, ', '));
  end if;

  if v_old.description is distinct from p_description then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'description', v_old.description, p_description);
  end if;

  if v_old.uses_per_week is distinct from v_uses then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'uses_per_week',
            v_old.uses_per_week::text, v_uses::text);
  end if;
  if v_old.minutes_saved_per_use is distinct from v_min_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'minutes_saved_per_use',
            v_old.minutes_saved_per_use::text, v_min_pu::text);
  end if;
  if v_old.cost_saved_per_use is distinct from v_cost_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'cost_saved_per_use',
            v_old.cost_saved_per_use::text, v_cost_pu::text);
  end if;
  if v_old.revenue_per_use is distinct from v_rev_pu then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'revenue_per_use',
            v_old.revenue_per_use::text, v_rev_pu::text);
  end if;

  if v_old.frequency_cadence is distinct from v_cadence then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'frequency_cadence',
            v_old.frequency_cadence, v_cadence);
  end if;

  if v_old.attribution_confidence is distinct from p_attribution_confidence then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'attribution_confidence',
            v_old.attribution_confidence, p_attribution_confidence);
  end if;

  if v_old.adoption_status is distinct from p_adoption_status then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'adoption_status',
            v_old.adoption_status, p_adoption_status);
  end if;

  if v_old.satisfaction is distinct from p_satisfaction then
    insert into public.intervention_edits
      (intervention_id, actor_id, actor_email, action, field, old_value, new_value)
    values (p_id, v_user_id, v_email, 'edit', 'satisfaction',
            v_old.satisfaction::text, p_satisfaction::text);
  end if;

  update public.ai_interventions
     set name                         = p_name,
         types                        = v_types,
         description                  = p_description,
         uses_per_week                = v_uses,
         minutes_saved_per_use        = v_min_pu,
         cost_saved_per_use           = v_cost_pu,
         revenue_per_use              = v_rev_pu,
         minutes_saved_per_week       = v_min_pu * v_uses,
         estimated_gbp_saved_per_week = v_cost_pu * v_uses,
         estimated_revenue_per_week   = v_rev_pu * v_uses,
         attribution_confidence       = p_attribution_confidence,
         adoption_status              = p_adoption_status,
         satisfaction                 = p_satisfaction,
         frequency_cadence            = v_cadence
   where id = p_id;
end;
$$;


ALTER FUNCTION "public"."update_intervention"("p_id" "uuid", "p_name" "text", "p_types" "text"[], "p_description" "text", "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_attribution_confidence" "text", "p_adoption_status" "text", "p_satisfaction" smallint, "p_frequency_cadence" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_emails"("p_user_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return;
  end if;
  if array_length(p_user_ids, 1) > 500 then
    raise exception 'user_emails: too many user_ids (max 500)';
  end if;
  return query
    select u.id as user_id, lower(u.email) as email
      from auth.users u
     where u.id = any(p_user_ids)
       and u.email is not null;
end;
$$;


ALTER FUNCTION "public"."user_emails"("p_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_id_for_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  caller_role text;
  result uuid;
begin
  select role into caller_role
    from public.role_grants
   where user_id = auth.uid();

  if caller_role is distinct from 'super_admin' then
    raise exception 'Only super_admin may resolve user emails'
      using errcode = '42501';
  end if;

  select id into result
    from auth.users
   where lower(email) = lower(p_email)
   limit 1;

  return result;
end;
$$;


ALTER FUNCTION "public"."user_id_for_email"("p_email" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_intervention_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_intervention_comments_body_check" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 2000)))
);


ALTER TABLE "public"."ai_intervention_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interventions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner" "text",
    "minutes_saved_per_week" numeric,
    "created_by" "uuid",
    "attribution_confidence" "text" DEFAULT 'medium'::"text",
    "vendor" "text",
    "estimated_gbp_saved_per_week" numeric,
    "estimated_revenue_per_week" numeric,
    "adoption_status" "text",
    "satisfaction" smallint,
    "recipient_emails" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tools_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "uses_per_week" numeric,
    "minutes_saved_per_use" numeric,
    "cost_saved_per_use" numeric,
    "revenue_per_use" numeric,
    "notes" "text",
    "shipped_at" timestamp with time zone,
    "frequency_cadence" "text",
    CONSTRAINT "ai_interventions_adoption_status_check" CHECK ((("adoption_status" IS NULL) OR ("adoption_status" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'occasional'::"text", 'abandoned'::"text"])))),
    CONSTRAINT "ai_interventions_confidence_check" CHECK (("attribution_confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "ai_interventions_frequency_cadence_check" CHECK ((("frequency_cadence" IS NULL) OR ("frequency_cadence" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'fortnightly'::"text", 'monthly'::"text"])))),
    CONSTRAINT "ai_interventions_per_use_bounds" CHECK (((("uses_per_week" IS NULL) OR (("uses_per_week" >= (0)::numeric) AND ("uses_per_week" <= (10000)::numeric))) AND (("minutes_saved_per_use" IS NULL) OR (("minutes_saved_per_use" >= (0)::numeric) AND ("minutes_saved_per_use" <= (100000)::numeric))) AND (("cost_saved_per_use" IS NULL) OR (("cost_saved_per_use" >= (0)::numeric) AND ("cost_saved_per_use" <= (10000000)::numeric))) AND (("revenue_per_use" IS NULL) OR (("revenue_per_use" >= (0)::numeric) AND ("revenue_per_use" <= (10000000)::numeric))))),
    CONSTRAINT "ai_interventions_satisfaction_check" CHECK ((("satisfaction" IS NULL) OR (("satisfaction" >= 1) AND ("satisfaction" <= 5)))),
    CONSTRAINT "ai_interventions_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'retired'::"text"])))),
    CONSTRAINT "ai_interventions_types_check" CHECK (("types" <@ ARRAY['tool'::"text", 'training'::"text", 'prompt'::"text", 'agent'::"text", 'automation'::"text", 'process_change'::"text"]))
);


ALTER TABLE "public"."ai_interventions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."champion_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "team" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "champion_notes_target_type_check" CHECK (("target_type" = ANY (ARRAY['workflow'::"text", 'intervention'::"text"])))
);


ALTER TABLE "public"."champion_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."champions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team" "text" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "last_check_in" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blurb" "text",
    "chewing_on" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."champions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digest_sends" (
    "period_key" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recipient_count" integer,
    "forced" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."digest_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_cosigns" (
    "intervention_id" "uuid" NOT NULL,
    "team" "text" NOT NULL,
    "signed_by" "uuid",
    "signed_by_name" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_cosigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_edits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "field" "text",
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "intervention_edits_action_check" CHECK (("action" = ANY (ARRAY['edit'::"text", 'status_change'::"text"])))
);


ALTER TABLE "public"."intervention_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "time_value" numeric,
    "cost_value" numeric,
    "people_value" numeric,
    "errors_value" numeric,
    "revenue_value" numeric,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "adoption_status" "text",
    "satisfaction" smallint,
    CONSTRAINT "intervention_metrics_adoption_status_check" CHECK ((("adoption_status" IS NULL) OR ("adoption_status" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'occasional'::"text", 'abandoned'::"text"])))),
    CONSTRAINT "intervention_metrics_satisfaction_check" CHECK ((("satisfaction" IS NULL) OR (("satisfaction" >= 1) AND ("satisfaction" <= 5)))),
    CONSTRAINT "intervention_metrics_value_bounds" CHECK (((("time_value" IS NULL) OR (("time_value" >= (0)::numeric) AND ("time_value" <= (1000000)::numeric))) AND (("cost_value" IS NULL) OR (("cost_value" >= (0)::numeric) AND ("cost_value" <= (10000000)::numeric))) AND (("people_value" IS NULL) OR (("people_value" >= (0)::numeric) AND ("people_value" <= (10000)::numeric))) AND (("errors_value" IS NULL) OR (("errors_value" >= (0)::numeric) AND ("errors_value" <= (1000000)::numeric))) AND (("revenue_value" IS NULL) OR (("revenue_value" >= (0)::numeric) AND ("revenue_value" <= (100000000)::numeric)))))
);


ALTER TABLE "public"."intervention_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_suggestion_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suggestion_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "intervention_suggestion_comments_body_check" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 2000)))
);


ALTER TABLE "public"."intervention_suggestion_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_suggestion_votes" (
    "suggestion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_suggestion_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "workflow_id" "uuid",
    "team" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "decline_reason" "text",
    "intervention_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "intervention_suggestions_body_check" CHECK ((("length"("body") >= 5) AND ("length"("body") <= 2000))),
    CONSTRAINT "intervention_suggestions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'under_review'::"text", 'accepted'::"text", 'in_progress'::"text", 'declined'::"text", 'shipped'::"text"]))),
    CONSTRAINT "intervention_suggestions_title_check" CHECK ((("length"("title") >= 3) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."intervention_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_workflows" (
    "intervention_id" "uuid" NOT NULL,
    "workflow_id" "uuid" NOT NULL
);


ALTER TABLE "public"."intervention_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "description" "text",
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learn_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_video_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learn_video_comments_body_check" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 2000)))
);


ALTER TABLE "public"."learn_video_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_video_plays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learn_video_plays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_video_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learn_video_reactions_emoji_check" CHECK ((("length"("emoji") >= 1) AND ("length"("emoji") <= 16)))
);


ALTER TABLE "public"."learn_video_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_video_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "url" "text",
    "storage_path" "text",
    "file_name" "text",
    "file_size" bigint,
    "file_mime" "text",
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learn_video_resources_kind_check" CHECK (("kind" = ANY (ARRAY['url'::"text", 'file'::"text"]))),
    CONSTRAINT "learn_video_resources_kind_payload" CHECK (((("kind" = 'url'::"text") AND ("url" IS NOT NULL) AND ("storage_path" IS NULL)) OR (("kind" = 'file'::"text") AND ("storage_path" IS NOT NULL) AND ("url" IS NULL))))
);


ALTER TABLE "public"."learn_video_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learn_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "loom_share_url" "text" NOT NULL,
    "loom_embed_id" "text" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "topic" "text",
    "subtopic" "text",
    "thumbnail_url" "text",
    CONSTRAINT "learn_videos_subtopic_check" CHECK ((("subtopic" IS NULL) OR ("subtopic" = 'claude'::"text"))),
    CONSTRAINT "learn_videos_topic_check" CHECK ((("topic" IS NULL) OR ("topic" = ANY (ARRAY['ai_ops'::"text", 'ai_foundations'::"text", 'prompt_engineering'::"text", 'ai_tools'::"text"]))))
);


ALTER TABLE "public"."learn_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "team" "text" NOT NULL,
    "start_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "title" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regulatory_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid",
    "step_id" "uuid",
    "severity" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "regulatory_events_severity_check" CHECK (("severity" = ANY (ARRAY['red'::"text", 'amber'::"text", 'green'::"text"])))
);


ALTER TABLE "public"."regulatory_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_grants" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "team" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "role_grants_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."role_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."step_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "step_id" "uuid" NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_by" "uuid",
    "changed_by_email" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."step_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_baselines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "time_value" numeric,
    "cost_value" numeric,
    "people_value" numeric,
    "errors_value" numeric,
    "revenue_value" numeric,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workflow_baselines_value_bounds" CHECK (((("time_value" IS NULL) OR (("time_value" >= (0)::numeric) AND ("time_value" <= (1000000)::numeric))) AND (("cost_value" IS NULL) OR (("cost_value" >= (0)::numeric) AND ("cost_value" <= (10000000)::numeric))) AND (("people_value" IS NULL) OR (("people_value" >= (0)::numeric) AND ("people_value" <= (10000)::numeric))) AND (("errors_value" IS NULL) OR (("errors_value" >= (0)::numeric) AND ("errors_value" <= (1000000)::numeric))) AND (("revenue_value" IS NULL) OR (("revenue_value" >= (0)::numeric) AND ("revenue_value" <= (100000000)::numeric)))))
);


ALTER TABLE "public"."workflow_baselines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_metrics" (
    "workflow_id" "uuid" NOT NULL,
    "time_baseline" numeric,
    "time_current" numeric,
    "cost_baseline" numeric,
    "cost_current" numeric,
    "people_baseline" numeric,
    "people_current" numeric,
    "errors_baseline" numeric,
    "errors_current" numeric,
    "revenue_baseline" numeric,
    "revenue_current" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_metrics_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "metric" "text" NOT NULL,
    "value" numeric NOT NULL,
    CONSTRAINT "wmh_value_bounds" CHECK ((("value" >= (0)::numeric) AND ((("metric" = 'time'::"text") AND ("value" <= (1000000)::numeric)) OR (("metric" = 'cost'::"text") AND ("value" <= (10000000)::numeric)) OR (("metric" = 'people'::"text") AND ("value" <= (10000)::numeric)) OR (("metric" = 'errors'::"text") AND ("value" <= (1000000)::numeric)) OR (("metric" = 'revenue'::"text") AND ("value" <= (100000000)::numeric))))),
    CONSTRAINT "workflow_metrics_history_metric_check" CHECK (("metric" = ANY (ARRAY['time'::"text", 'cost'::"text", 'people'::"text", 'errors'::"text", 'revenue'::"text"])))
);


ALTER TABLE "public"."workflow_metrics_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_by" "uuid",
    "changed_by_email" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "owner" "text",
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "regulatory_flag" "text",
    CONSTRAINT "workflow_steps_regulatory_flag_check" CHECK ((("regulatory_flag" IS NULL) OR ("regulatory_flag" = ANY (ARRAY['red'::"text", 'amber'::"text", 'green'::"text"]))))
);


ALTER TABLE "public"."workflow_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "team" "text",
    "regulatory" boolean DEFAULT false NOT NULL,
    "frequency" "text",
    "criticality" "text",
    "business_kpi" "text",
    "owner_names" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "frequency_per_week" numeric DEFAULT 0,
    "criticality_score" integer DEFAULT 3,
    "walkthrough" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tools_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "frequency_cadence" "text",
    CONSTRAINT "workflows_criticality_check" CHECK (("criticality" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "workflows_criticality_score_check" CHECK ((("criticality_score" >= 1) AND ("criticality_score" <= 5))),
    CONSTRAINT "workflows_frequency_cadence_check" CHECK ((("frequency_cadence" IS NULL) OR ("frequency_cadence" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'fortnightly'::"text", 'monthly'::"text"])))),
    CONSTRAINT "workflows_frequency_per_week_check" CHECK (("frequency_per_week" >= (0)::numeric))
);


ALTER TABLE "public"."workflows" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_intervention_comments"
    ADD CONSTRAINT "ai_intervention_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_interventions"
    ADD CONSTRAINT "ai_interventions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."champion_notes"
    ADD CONSTRAINT "champion_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."champion_notes"
    ADD CONSTRAINT "champion_notes_target_type_target_id_team_key" UNIQUE ("target_type", "target_id", "team");



ALTER TABLE ONLY "public"."champions"
    ADD CONSTRAINT "champions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."champions"
    ADD CONSTRAINT "champions_team_key" UNIQUE ("team");



ALTER TABLE ONLY "public"."digest_sends"
    ADD CONSTRAINT "digest_sends_pkey" PRIMARY KEY ("period_key");



ALTER TABLE ONLY "public"."intervention_cosigns"
    ADD CONSTRAINT "intervention_cosigns_pkey" PRIMARY KEY ("intervention_id", "team");



ALTER TABLE ONLY "public"."intervention_edits"
    ADD CONSTRAINT "intervention_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_metrics"
    ADD CONSTRAINT "intervention_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_suggestion_comments"
    ADD CONSTRAINT "intervention_suggestion_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_suggestion_votes"
    ADD CONSTRAINT "intervention_suggestion_votes_pkey" PRIMARY KEY ("suggestion_id", "user_id");



ALTER TABLE ONLY "public"."intervention_suggestions"
    ADD CONSTRAINT "intervention_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_workflows"
    ADD CONSTRAINT "intervention_workflows_pkey" PRIMARY KEY ("intervention_id", "workflow_id");



ALTER TABLE ONLY "public"."learn_resources"
    ADD CONSTRAINT "learn_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learn_video_comments"
    ADD CONSTRAINT "learn_video_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learn_video_plays"
    ADD CONSTRAINT "learn_video_plays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learn_video_reactions"
    ADD CONSTRAINT "learn_video_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learn_video_reactions"
    ADD CONSTRAINT "learn_video_reactions_video_id_user_id_emoji_key" UNIQUE ("video_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."learn_video_resources"
    ADD CONSTRAINT "learn_video_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learn_videos"
    ADD CONSTRAINT "learn_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."regulatory_events"
    ADD CONSTRAINT "regulatory_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_grants"
    ADD CONSTRAINT "role_grants_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."step_revisions"
    ADD CONSTRAINT "step_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_baselines"
    ADD CONSTRAINT "workflow_baselines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_baselines"
    ADD CONSTRAINT "workflow_baselines_workflow_id_intervention_id_key" UNIQUE ("workflow_id", "intervention_id");



ALTER TABLE ONLY "public"."workflow_metrics_history"
    ADD CONSTRAINT "workflow_metrics_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_metrics_history"
    ADD CONSTRAINT "workflow_metrics_history_workflow_id_snapshot_date_metric_key" UNIQUE ("workflow_id", "snapshot_date", "metric");



ALTER TABLE ONLY "public"."workflow_metrics"
    ADD CONSTRAINT "workflow_metrics_pkey" PRIMARY KEY ("workflow_id");



ALTER TABLE ONLY "public"."workflow_revisions"
    ADD CONSTRAINT "workflow_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_steps"
    ADD CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_interventions_created_idx" ON "public"."ai_interventions" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_interventions_recipient_emails_gin" ON "public"."ai_interventions" USING "gin" ("recipient_emails");



CREATE INDEX "ai_interventions_shipped_at_idx" ON "public"."ai_interventions" USING "btree" ("shipped_at") WHERE ("shipped_at" IS NOT NULL);



CREATE INDEX "ai_interventions_status_idx" ON "public"."ai_interventions" USING "btree" ("status");



CREATE INDEX "ai_interventions_tools_used_gin" ON "public"."ai_interventions" USING "gin" ("tools_used");



CREATE INDEX "ai_interventions_types_gin" ON "public"."ai_interventions" USING "gin" ("types");



CREATE INDEX "aic_intervention_idx" ON "public"."ai_intervention_comments" USING "btree" ("intervention_id", "created_at" DESC);



CREATE INDEX "champion_notes_target_idx" ON "public"."champion_notes" USING "btree" ("target_type", "target_id");



CREATE INDEX "champion_notes_team_idx" ON "public"."champion_notes" USING "btree" ("team");



CREATE INDEX "intervention_cosigns_intervention_idx" ON "public"."intervention_cosigns" USING "btree" ("intervention_id");



CREATE INDEX "intervention_edits_intervention_idx" ON "public"."intervention_edits" USING "btree" ("intervention_id", "created_at" DESC);



CREATE INDEX "intervention_metrics_intervention_idx" ON "public"."intervention_metrics" USING "btree" ("intervention_id", "snapshot_date" DESC);



CREATE INDEX "intervention_suggestions_intervention_idx" ON "public"."intervention_suggestions" USING "btree" ("intervention_id");



CREATE INDEX "intervention_suggestions_status_idx" ON "public"."intervention_suggestions" USING "btree" ("status");



CREATE INDEX "intervention_suggestions_team_idx" ON "public"."intervention_suggestions" USING "btree" ("team");



CREATE INDEX "isc_suggestion_idx" ON "public"."intervention_suggestion_comments" USING "btree" ("suggestion_id", "created_at" DESC);



CREATE INDEX "learn_resources_created_idx" ON "public"."learn_resources" USING "btree" ("created_at" DESC);



CREATE INDEX "learn_video_comments_video_idx" ON "public"."learn_video_comments" USING "btree" ("video_id", "created_at" DESC);



CREATE INDEX "learn_video_plays_video_idx" ON "public"."learn_video_plays" USING "btree" ("video_id");



CREATE INDEX "learn_video_plays_video_user_idx" ON "public"."learn_video_plays" USING "btree" ("video_id", "user_id");



CREATE INDEX "learn_video_reactions_video_idx" ON "public"."learn_video_reactions" USING "btree" ("video_id");



CREATE INDEX "learn_video_resources_video_idx" ON "public"."learn_video_resources" USING "btree" ("video_id", "created_at" DESC);



CREATE INDEX "learn_videos_created_idx" ON "public"."learn_videos" USING "btree" ("created_at" DESC);



CREATE INDEX "learn_videos_subtopic_idx" ON "public"."learn_videos" USING "btree" ("subtopic");



CREATE INDEX "learn_videos_topic_idx" ON "public"."learn_videos" USING "btree" ("topic");



CREATE INDEX "people_email_lower_idx" ON "public"."people" USING "btree" ("lower"("email"));



CREATE INDEX "people_team_idx" ON "public"."people" USING "btree" ("team");



CREATE INDEX "regulatory_events_unresolved_idx" ON "public"."regulatory_events" USING "btree" ("created_at" DESC) WHERE ("resolved_at" IS NULL);



CREATE INDEX "regulatory_events_workflow_idx" ON "public"."regulatory_events" USING "btree" ("workflow_id");



CREATE INDEX "step_revisions_workflow_idx" ON "public"."step_revisions" USING "btree" ("workflow_id", "changed_at" DESC);



CREATE INDEX "wmh_workflow_idx" ON "public"."workflow_metrics_history" USING "btree" ("workflow_id", "snapshot_date");



CREATE INDEX "workflow_baselines_intervention_idx" ON "public"."workflow_baselines" USING "btree" ("intervention_id");



CREATE INDEX "workflow_revisions_workflow_idx" ON "public"."workflow_revisions" USING "btree" ("workflow_id", "changed_at" DESC);



CREATE INDEX "workflow_steps_regulatory_flag_idx" ON "public"."workflow_steps" USING "btree" ("regulatory_flag") WHERE ("regulatory_flag" IS NOT NULL);



CREATE INDEX "workflow_steps_workflow_idx" ON "public"."workflow_steps" USING "btree" ("workflow_id", "position");



CREATE INDEX "workflows_active_idx" ON "public"."workflows" USING "btree" ("active");



CREATE INDEX "workflows_deleted_at_idx" ON "public"."workflows" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "workflows_team_idx" ON "public"."workflows" USING "btree" ("team");



CREATE INDEX "workflows_tools_used_gin" ON "public"."workflows" USING "gin" ("tools_used");



CREATE OR REPLACE TRIGGER "tg_intervention_suggestions_touch" BEFORE UPDATE ON "public"."intervention_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_intervention_suggestions_touch"();



ALTER TABLE ONLY "public"."ai_intervention_comments"
    ADD CONSTRAINT "ai_intervention_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_intervention_comments"
    ADD CONSTRAINT "ai_intervention_comments_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_interventions"
    ADD CONSTRAINT "ai_interventions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."champion_notes"
    ADD CONSTRAINT "champion_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."champions"
    ADD CONSTRAINT "champions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intervention_cosigns"
    ADD CONSTRAINT "intervention_cosigns_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_cosigns"
    ADD CONSTRAINT "intervention_cosigns_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."intervention_edits"
    ADD CONSTRAINT "intervention_edits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."intervention_edits"
    ADD CONSTRAINT "intervention_edits_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_metrics"
    ADD CONSTRAINT "intervention_metrics_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."intervention_metrics"
    ADD CONSTRAINT "intervention_metrics_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_suggestion_comments"
    ADD CONSTRAINT "intervention_suggestion_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intervention_suggestion_comments"
    ADD CONSTRAINT "intervention_suggestion_comments_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."intervention_suggestions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_suggestion_votes"
    ADD CONSTRAINT "intervention_suggestion_votes_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."intervention_suggestions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_suggestion_votes"
    ADD CONSTRAINT "intervention_suggestion_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_suggestions"
    ADD CONSTRAINT "intervention_suggestions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intervention_suggestions"
    ADD CONSTRAINT "intervention_suggestions_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intervention_suggestions"
    ADD CONSTRAINT "intervention_suggestions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intervention_workflows"
    ADD CONSTRAINT "intervention_workflows_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_workflows"
    ADD CONSTRAINT "intervention_workflows_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_resources"
    ADD CONSTRAINT "learn_resources_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learn_video_comments"
    ADD CONSTRAINT "learn_video_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learn_video_comments"
    ADD CONSTRAINT "learn_video_comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."learn_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_video_plays"
    ADD CONSTRAINT "learn_video_plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_video_plays"
    ADD CONSTRAINT "learn_video_plays_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."learn_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_video_reactions"
    ADD CONSTRAINT "learn_video_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_video_reactions"
    ADD CONSTRAINT "learn_video_reactions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."learn_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_video_resources"
    ADD CONSTRAINT "learn_video_resources_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learn_video_resources"
    ADD CONSTRAINT "learn_video_resources_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."learn_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learn_videos"
    ADD CONSTRAINT "learn_videos_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regulatory_events"
    ADD CONSTRAINT "regulatory_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."regulatory_events"
    ADD CONSTRAINT "regulatory_events_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."regulatory_events"
    ADD CONSTRAINT "regulatory_events_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_grants"
    ADD CONSTRAINT "role_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_revisions"
    ADD CONSTRAINT "step_revisions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."step_revisions"
    ADD CONSTRAINT "step_revisions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_revisions"
    ADD CONSTRAINT "step_revisions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_baselines"
    ADD CONSTRAINT "workflow_baselines_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."ai_interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_baselines"
    ADD CONSTRAINT "workflow_baselines_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_metrics_history"
    ADD CONSTRAINT "workflow_metrics_history_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_metrics"
    ADD CONSTRAINT "workflow_metrics_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_revisions"
    ADD CONSTRAINT "workflow_revisions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workflow_revisions"
    ADD CONSTRAINT "workflow_revisions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_steps"
    ADD CONSTRAINT "workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE "public"."ai_intervention_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_interventions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aic_delete_priv" ON "public"."ai_intervention_comments" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))));



CREATE POLICY "aic_insert_self" ON "public"."ai_intervention_comments" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "aic_read" ON "public"."ai_intervention_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth insert ai_interventions" ON "public"."ai_interventions" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "auth insert intervention_edits" ON "public"."intervention_edits" FOR INSERT TO "authenticated" WITH CHECK (("actor_id" = "auth"."uid"()));



CREATE POLICY "auth insert intervention_metrics" ON "public"."intervention_metrics" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "auth insert intervention_workflows" ON "public"."intervention_workflows" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth insert learn_resources" ON "public"."learn_resources" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "added_by"));



CREATE POLICY "auth insert own learn_video_play" ON "public"."learn_video_plays" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth insert workflow_baselines" ON "public"."workflow_baselines" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth insert workflow_metrics" ON "public"."workflow_metrics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth insert workflows" ON "public"."workflows" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "auth read ai_interventions" ON "public"."ai_interventions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read champion_notes" ON "public"."champion_notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read champions" ON "public"."champions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read intervention_cosigns" ON "public"."intervention_cosigns" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read intervention_edits" ON "public"."intervention_edits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read intervention_metrics" ON "public"."intervention_metrics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read intervention_workflows" ON "public"."intervention_workflows" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read learn_resources" ON "public"."learn_resources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read learn_video_plays" ON "public"."learn_video_plays" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read learn_video_resources" ON "public"."learn_video_resources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read learn_videos" ON "public"."learn_videos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read regulatory_events" ON "public"."regulatory_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read step_revisions" ON "public"."step_revisions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read workflow_baselines" ON "public"."workflow_baselines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read workflow_metrics" ON "public"."workflow_metrics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read workflow_steps" ON "public"."workflow_steps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth read workflows" ON "public"."workflows" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))));



CREATE POLICY "auth update workflow_metrics" ON "public"."workflow_metrics" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth update workflows" ON "public"."workflows" FOR UPDATE TO "authenticated" USING ("public"."can_delete_workflow"("id")) WITH CHECK ("public"."can_delete_workflow"("id"));



CREATE POLICY "author or admin delete learn_resources" ON "public"."learn_resources" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "added_by") OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))));



CREATE POLICY "champion update own editorial" ON "public"."champions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "champion write champion_notes" ON "public"."champion_notes" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."champions" "c"
  WHERE (("c"."team" = "champion_notes"."team") AND ("c"."user_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."champions" "c"
  WHERE (("c"."team" = "champion_notes"."team") AND ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "champion write intervention_cosigns" ON "public"."intervention_cosigns" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."champions" "c"
  WHERE (("c"."team" = "intervention_cosigns"."team") AND ("c"."user_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."champions" "c"
  WHERE (("c"."team" = "intervention_cosigns"."team") AND ("c"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."champion_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."champions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_priv" ON "public"."intervention_suggestion_comments" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))));



CREATE POLICY "comments_insert_self" ON "public"."intervention_suggestion_comments" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "comments_read" ON "public"."intervention_suggestion_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "delete ai_interventions super" ON "public"."ai_interventions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."digest_sends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "edit ai_interventions" ON "public"."ai_interventions" FOR UPDATE TO "authenticated" USING ("public"."can_edit_intervention"("id")) WITH CHECK ("public"."can_edit_intervention"("id"));



ALTER TABLE "public"."intervention_cosigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_suggestion_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_suggestion_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_workflows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_video_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_video_plays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_video_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_video_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learn_videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lvc_delete_priv" ON "public"."learn_video_comments" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))));



CREATE POLICY "lvc_insert_self" ON "public"."learn_video_comments" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "lvc_read" ON "public"."learn_video_comments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "people read all" ON "public"."people" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles insert own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles read all" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles update own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reactions_delete_self" ON "public"."learn_video_reactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reactions_insert_self" ON "public"."learn_video_reactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "reactions_read" ON "public"."learn_video_reactions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."regulatory_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."step_revisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suggestions_delete_super" ON "public"."intervention_suggestions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "suggestions_insert_own" ON "public"."intervention_suggestions" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "suggestions_read" ON "public"."intervention_suggestions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "suggestions_update_priv" ON "public"."intervention_suggestions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."champions" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."team" = "intervention_suggestions"."team")))) OR (("created_by" = "auth"."uid"()) AND ("status" = 'open'::"text"))));



CREATE POLICY "super_admin read workflow_revisions" ON "public"."workflow_revisions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write champions" ON "public"."champions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write learn_video_resources" ON "public"."learn_video_resources" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write learn_videos" ON "public"."learn_videos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write people" ON "public"."people" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "super_admin write regulatory_events" ON "public"."regulatory_events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND ("g"."role" = 'super_admin'::"text")))));



CREATE POLICY "team or super_admin or creator delete workflow_steps" ON "public"."workflow_steps" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))));



CREATE POLICY "team or super_admin or creator insert revisions" ON "public"."step_revisions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "step_revisions"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))));



CREATE POLICY "team or super_admin or creator or owner delete workflow_steps" ON "public"."workflow_steps" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id")));



CREATE POLICY "team or super_admin or creator or owner insert revisions" ON "public"."step_revisions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "step_revisions"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id")));



CREATE POLICY "team or super_admin or creator or owner insert workflow_steps" ON "public"."workflow_steps" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id")));



CREATE POLICY "team or super_admin or creator or owner update steps" ON "public"."workflow_steps" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id")));



CREATE POLICY "team or super_admin or creator or owner update workflows" ON "public"."workflows" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND (("g"."role" = 'super_admin'::"text") OR ("g"."team" = "workflows"."team"))))) OR "public"."is_workflow_name_owner"("id"))) WITH CHECK ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND (("g"."role" = 'super_admin'::"text") OR ("g"."team" = "workflows"."team"))))) OR "public"."is_workflow_name_owner"("id")));



CREATE POLICY "team or super_admin or creator or owner write workflow_revision" ON "public"."workflow_revisions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_revisions"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))) OR "public"."is_workflow_name_owner"("workflow_id")));



CREATE POLICY "team or super_admin or creator update steps" ON "public"."workflow_steps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_steps"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))));



CREATE POLICY "team or super_admin or creator update workflows" ON "public"."workflows" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND (("g"."role" = 'super_admin'::"text") OR ("g"."team" = "workflows"."team"))))))) WITH CHECK ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."role_grants" "g"
  WHERE (("g"."user_id" = "auth"."uid"()) AND (("g"."role" = 'super_admin'::"text") OR ("g"."team" = "workflows"."team")))))));



CREATE POLICY "team or super_admin or creator write workflow_revisions" ON "public"."workflow_revisions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."workflows" "w"
     LEFT JOIN "public"."role_grants" "g" ON (("g"."user_id" = "auth"."uid"())))
  WHERE (("w"."id" = "workflow_revisions"."workflow_id") AND (("w"."created_by" = "auth"."uid"()) OR ("g"."role" = 'super_admin'::"text") OR ("g"."team" = "w"."team"))))));



CREATE POLICY "users insert own grant" ON "public"."role_grants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own grant" ON "public"."role_grants" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users update own grant" ON "public"."role_grants" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "votes_delete_self" ON "public"."intervention_suggestion_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "votes_insert_self" ON "public"."intervention_suggestion_votes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "votes_read" ON "public"."intervention_suggestion_votes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "wmh insert authed" ON "public"."workflow_metrics_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "wmh read all" ON "public"."workflow_metrics_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."workflow_baselines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_metrics_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_revisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflows" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."can_delete_workflow"("p_workflow_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."can_edit_intervention"("p_intervention_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_intervention"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_intervention"("p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_workflow_name_owner"("p_workflow_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."log_intervention"("p_name" "text", "p_types" "text"[], "p_workflow_ids" "uuid"[], "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_description" "text", "p_attribution_confidence" "text", "p_adoption_status" "text", "p_satisfaction" smallint, "p_recipient_emails" "text"[], "p_tools_used" "text"[], "p_frequency_cadence" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."recent_logins"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recent_logins"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_intervention_status"("p_id" "uuid", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."signed_in_emails"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."signed_in_emails"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."swap_step_positions"("p_step_a" "uuid", "p_step_b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."swap_step_positions"("p_step_a" "uuid", "p_step_b" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_intervention"("p_id" "uuid", "p_name" "text", "p_types" "text"[], "p_description" "text", "p_uses_per_week" numeric, "p_minutes_saved_per_use" numeric, "p_cost_saved_per_use" numeric, "p_revenue_per_use" numeric, "p_attribution_confidence" "text", "p_adoption_status" "text", "p_satisfaction" smallint, "p_frequency_cadence" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."user_emails"("p_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_emails"("p_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_emails"("p_user_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_id_for_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_id_for_email"("p_email" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_intervention_comments" TO "anon";
GRANT ALL ON TABLE "public"."ai_intervention_comments" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_intervention_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interventions" TO "anon";
GRANT ALL ON TABLE "public"."ai_interventions" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interventions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."champion_notes" TO "anon";
GRANT ALL ON TABLE "public"."champion_notes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."champion_notes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."champions" TO "anon";
GRANT ALL ON TABLE "public"."champions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."champions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."digest_sends" TO "anon";
GRANT ALL ON TABLE "public"."digest_sends" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."digest_sends" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_cosigns" TO "anon";
GRANT ALL ON TABLE "public"."intervention_cosigns" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_cosigns" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_edits" TO "anon";
GRANT ALL ON TABLE "public"."intervention_edits" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_edits" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_metrics" TO "anon";
GRANT ALL ON TABLE "public"."intervention_metrics" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_metrics" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestion_comments" TO "anon";
GRANT ALL ON TABLE "public"."intervention_suggestion_comments" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestion_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestion_votes" TO "anon";
GRANT ALL ON TABLE "public"."intervention_suggestion_votes" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestion_votes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."intervention_suggestions" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_suggestions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_workflows" TO "anon";
GRANT ALL ON TABLE "public"."intervention_workflows" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."intervention_workflows" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_resources" TO "anon";
GRANT ALL ON TABLE "public"."learn_resources" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_resources" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_comments" TO "anon";
GRANT ALL ON TABLE "public"."learn_video_comments" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_plays" TO "anon";
GRANT ALL ON TABLE "public"."learn_video_plays" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_plays" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_reactions" TO "anon";
GRANT ALL ON TABLE "public"."learn_video_reactions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_reactions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_resources" TO "anon";
GRANT ALL ON TABLE "public"."learn_video_resources" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_video_resources" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_videos" TO "anon";
GRANT ALL ON TABLE "public"."learn_videos" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."learn_videos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."people" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."regulatory_events" TO "anon";
GRANT ALL ON TABLE "public"."regulatory_events" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."regulatory_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_grants" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."role_grants" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_grants" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."step_revisions" TO "anon";
GRANT ALL ON TABLE "public"."step_revisions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."step_revisions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_baselines" TO "anon";
GRANT ALL ON TABLE "public"."workflow_baselines" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_baselines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_metrics" TO "anon";
GRANT ALL ON TABLE "public"."workflow_metrics" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_metrics" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_metrics_history" TO "anon";
GRANT ALL ON TABLE "public"."workflow_metrics_history" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_metrics_history" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_revisions" TO "anon";
GRANT ALL ON TABLE "public"."workflow_revisions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_revisions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_steps" TO "anon";
GRANT ALL ON TABLE "public"."workflow_steps" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflow_steps" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflows" TO "anon";
GRANT ALL ON TABLE "public"."workflows" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workflows" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";









-- =========================================================================
-- auth.users triggers (cross-schema; not captured by --schema public dump,
-- but required for signup to work). Trigger functions themselves live in
-- the public schema and are already created above; we only need to attach
-- them. Idempotent.
-- =========================================================================

DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

DROP TRIGGER IF EXISTS "enforce_phlo_email_trigger" ON "auth"."users";
CREATE TRIGGER "enforce_phlo_email_trigger"
  BEFORE INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_phlo_email"();
