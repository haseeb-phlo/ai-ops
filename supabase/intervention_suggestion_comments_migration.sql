-- =========================================================================
-- Phlo AI Ops - comments on intervention suggestions
--
-- Lightweight discussion thread on each suggestion. Anyone authenticated
-- can read + post; comment authors can edit/delete their own; super-admins
-- can delete any comment so spam / drift can be cleaned up.
--
-- Run after intervention_suggestions_migration.sql. Safe to re-run.
-- =========================================================================

create table if not exists public.intervention_suggestion_comments (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.intervention_suggestions(id) on delete cascade,
  body          text not null check (length(body) between 1 and 2000),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists isc_suggestion_idx
  on public.intervention_suggestion_comments (suggestion_id, created_at desc);

alter table public.intervention_suggestion_comments enable row level security;

drop policy if exists "comments_read" on public.intervention_suggestion_comments;
create policy "comments_read"
  on public.intervention_suggestion_comments
  for select
  to authenticated
  using (true);

drop policy if exists "comments_insert_self" on public.intervention_suggestion_comments;
create policy "comments_insert_self"
  on public.intervention_suggestion_comments
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "comments_delete_priv" on public.intervention_suggestion_comments;
create policy "comments_delete_priv"
  on public.intervention_suggestion_comments
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
        where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

notify pgrst, 'reload schema';
