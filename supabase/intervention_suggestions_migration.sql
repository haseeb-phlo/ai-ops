-- =========================================================================
-- Phlo AI Ops - intervention suggestions
--
-- A lightweight idea pipeline that sits upstream of ai_interventions. Anyone
-- can submit a suggestion, anyone can vote on one, the team's AI Champion
-- triages, and a super-admin commits the company to building (and links a
-- shipped intervention back to its originating suggestion(s)).
--
-- Multiple suggestions can map to the same intervention_id, so a single
-- shipped intervention can mark several suggestions as resolved at once.
--
-- Safe to re-run.
-- =========================================================================

create table if not exists public.intervention_suggestions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(title) between 3 and 200),
  body            text not null check (length(body) between 5 and 2000),
  workflow_id     uuid references public.workflows(id) on delete set null,
  team            text,
  status          text not null default 'open' check (status in (
    'open','under_review','accepted','declined','shipped'
  )),
  decline_reason  text,
  intervention_id uuid references public.ai_interventions(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists intervention_suggestions_status_idx
  on public.intervention_suggestions (status);
create index if not exists intervention_suggestions_team_idx
  on public.intervention_suggestions (team);
create index if not exists intervention_suggestions_intervention_idx
  on public.intervention_suggestions (intervention_id);

create table if not exists public.intervention_suggestion_votes (
  suggestion_id uuid references public.intervention_suggestions(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

-- Trigger to keep updated_at fresh on edits.
create or replace function public.tg_intervention_suggestions_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tg_intervention_suggestions_touch on public.intervention_suggestions;
create trigger tg_intervention_suggestions_touch
  before update on public.intervention_suggestions
  for each row execute function public.tg_intervention_suggestions_touch();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.intervention_suggestions enable row level security;
alter table public.intervention_suggestion_votes enable row level security;

-- Suggestions: any authenticated user can read.
drop policy if exists "suggestions_read" on public.intervention_suggestions;
create policy "suggestions_read"
  on public.intervention_suggestions
  for select
  to authenticated
  using (true);

-- Suggestions: any authenticated user can insert their own row. Status flow
-- is enforced by the server actions, not at DB level - keeping insert open
-- simplifies the typical happy path.
drop policy if exists "suggestions_insert_own" on public.intervention_suggestions;
create policy "suggestions_insert_own"
  on public.intervention_suggestions
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Suggestions: super-admins can update + delete anything; champions of the
-- suggestion's team can update; the original submitter can update only
-- while the suggestion is still `open`.
drop policy if exists "suggestions_update_priv" on public.intervention_suggestions;
create policy "suggestions_update_priv"
  on public.intervention_suggestions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.role_grants g
        where g.user_id = auth.uid() and g.role = 'super_admin'
    )
    or exists (
      select 1 from public.champions c
        where c.user_id = auth.uid()
          and c.team = intervention_suggestions.team
    )
    or (created_by = auth.uid() and status = 'open')
  );

drop policy if exists "suggestions_delete_super" on public.intervention_suggestions;
create policy "suggestions_delete_super"
  on public.intervention_suggestions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.role_grants g
        where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

-- Votes: each user can read all, insert/delete only their own.
drop policy if exists "votes_read" on public.intervention_suggestion_votes;
create policy "votes_read"
  on public.intervention_suggestion_votes
  for select
  to authenticated
  using (true);

drop policy if exists "votes_insert_self" on public.intervention_suggestion_votes;
create policy "votes_insert_self"
  on public.intervention_suggestion_votes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "votes_delete_self" on public.intervention_suggestion_votes;
create policy "votes_delete_self"
  on public.intervention_suggestion_votes
  for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
