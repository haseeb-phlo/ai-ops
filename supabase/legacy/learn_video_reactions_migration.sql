-- =========================================================================
-- Phlo AI Ops - emoji reactions on Learn videos (additive)
--
-- One row per (video, user, emoji). Toggling the same emoji twice deletes
-- the user's row, so the card never shows duplicates. The UI picker uses
-- a fixed allowlist; the DB column is free-form text so we don't have to
-- migrate when the picker set changes.
--
-- Run AFTER learn_migration.sql. Safe to re-run.
-- =========================================================================

create table if not exists public.learn_video_reactions (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.learn_videos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null check (length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  unique (video_id, user_id, emoji)
);

create index if not exists learn_video_reactions_video_idx
  on public.learn_video_reactions (video_id);

alter table public.learn_video_reactions enable row level security;

drop policy if exists "reactions_read"        on public.learn_video_reactions;
drop policy if exists "reactions_insert_self" on public.learn_video_reactions;
drop policy if exists "reactions_delete_self" on public.learn_video_reactions;

-- Anyone signed in can read - we display reactor names on every card.
create policy "reactions_read"
  on public.learn_video_reactions for select
  to authenticated using (true);

-- A user may only react as themselves.
create policy "reactions_insert_self"
  on public.learn_video_reactions for insert
  to authenticated with check (auth.uid() = user_id);

-- A user may only un-react their own row.
create policy "reactions_delete_self"
  on public.learn_video_reactions for delete
  to authenticated using (auth.uid() = user_id);

notify pgrst, 'reload schema';
