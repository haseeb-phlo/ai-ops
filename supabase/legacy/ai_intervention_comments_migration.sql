-- =========================================================================
-- Phlo AI Ops - comments on AI initiatives (interventions)
--
-- Mirrors public.intervention_suggestion_comments. Lightweight discussion
-- thread on each ai_interventions row. Any authenticated user can read +
-- post; authors and super-admins can delete.
--
-- Run after interventions_migration.sql. Safe to re-run.
-- =========================================================================

create table if not exists public.ai_intervention_comments (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.ai_interventions(id) on delete cascade,
  body            text not null check (length(body) between 1 and 2000),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists aic_intervention_idx
  on public.ai_intervention_comments (intervention_id, created_at desc);

alter table public.ai_intervention_comments enable row level security;

drop policy if exists "aic_read" on public.ai_intervention_comments;
create policy "aic_read"
  on public.ai_intervention_comments
  for select
  to authenticated
  using (true);

drop policy if exists "aic_insert_self" on public.ai_intervention_comments;
create policy "aic_insert_self"
  on public.ai_intervention_comments
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "aic_delete_priv" on public.ai_intervention_comments;
create policy "aic_delete_priv"
  on public.ai_intervention_comments
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
