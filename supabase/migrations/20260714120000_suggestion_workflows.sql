-- A suggestion (and therefore a roadmap item) can help more than one
-- workflow. Replaces the single intervention_suggestions.workflow_id FK
-- with a suggestion_workflows junction, mirroring intervention_workflows
-- on the initiatives side. Existing links are backfilled before the old
-- column drops.

create table if not exists "public"."suggestion_workflows" (
    "suggestion_id" "uuid" not null,
    "workflow_id" "uuid" not null
);

alter table "public"."suggestion_workflows" owner to "postgres";

alter table only "public"."suggestion_workflows"
    add constraint "suggestion_workflows_pkey" primary key ("suggestion_id", "workflow_id");

alter table only "public"."suggestion_workflows"
    add constraint "suggestion_workflows_suggestion_id_fkey" foreign key ("suggestion_id") references "public"."intervention_suggestions"("id") on delete cascade;

alter table only "public"."suggestion_workflows"
    add constraint "suggestion_workflows_workflow_id_fkey" foreign key ("workflow_id") references "public"."workflows"("id") on delete cascade;

alter table "public"."suggestion_workflows" enable row level security;

-- Who may change a suggestion's workflow links: the same set that may
-- update the suggestion row itself (mirrors suggestions_update_priv):
-- super-admins, champions of the suggestion's team, and the creator while
-- the suggestion is still open.
create or replace function "public"."can_edit_suggestion"("p_suggestion_id" "uuid")
    returns boolean
    language "sql"
    stable
    security definer
    set "search_path" to 'public'
    as $$
  select exists (
    select 1 from public.role_grants g
    where g.user_id = auth.uid() and g.role = 'super_admin'
  ) or exists (
    select 1
    from public.intervention_suggestions s
    left join public.champions c
      on c.team = s.team and c.user_id = auth.uid()
    where s.id = p_suggestion_id
      and (c.user_id is not null
           or (s.created_by = auth.uid() and s.status = 'open'))
  );
$$;

alter function "public"."can_edit_suggestion"("uuid") owner to "postgres";

create policy "auth read suggestion_workflows" on "public"."suggestion_workflows"
    for select to "authenticated" using (true);

create policy "suggestion_workflows_insert_priv" on "public"."suggestion_workflows"
    for insert to "authenticated" with check ("public"."can_edit_suggestion"("suggestion_id"));

create policy "suggestion_workflows_delete_priv" on "public"."suggestion_workflows"
    for delete to "authenticated" using ("public"."can_edit_suggestion"("suggestion_id"));

grant references, trigger, truncate, maintain on table "public"."suggestion_workflows" to "anon";
grant all on table "public"."suggestion_workflows" to "authenticated";
grant select, references, trigger, truncate, maintain on table "public"."suggestion_workflows" to "service_role";

-- Backfill, then drop the single-link column (its FK goes with it).
insert into "public"."suggestion_workflows" ("suggestion_id", "workflow_id")
select "id", "workflow_id"
from "public"."intervention_suggestions"
where "workflow_id" is not null
on conflict do nothing;

alter table "public"."intervention_suggestions" drop column "workflow_id";
