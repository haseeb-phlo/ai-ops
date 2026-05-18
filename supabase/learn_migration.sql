-- =========================================================================
-- Phlo AI Ops - Learn tab migration (additive)
-- Run in Supabase Studio → SQL Editor AFTER schema.sql + admin_migration.sql.
-- Safe to re-run.
-- =========================================================================
-- Three tables:
--   learn_videos       - Loom share URLs uploaded by super_admins for AI training.
--   learn_video_plays  - one row per "play" click. Total = rows; unique = distinct
--                        user_ids. We keep every event (not just first-view) so
--                        rewatches are visible without losing the unique count.
--   learn_resources    - external links any signed-in user can add.

-- 1. learn_videos ---------------------------------------------------------
create table if not exists public.learn_videos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  -- Original Loom share URL the user pasted (kept for "Open in Loom" link).
  loom_share_url  text not null,
  -- The 32-char hex slug pulled from the URL. Used to build the embed iframe
  -- so we don't have to re-parse on every render.
  loom_embed_id   text not null,
  added_by        uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists learn_videos_created_idx
  on public.learn_videos(created_at desc);

alter table public.learn_videos enable row level security;

drop policy if exists "auth read learn_videos"         on public.learn_videos;
drop policy if exists "super_admin write learn_videos" on public.learn_videos;

create policy "auth read learn_videos"
  on public.learn_videos for select to authenticated using (true);

create policy "super_admin write learn_videos"
  on public.learn_videos for all to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

-- 2. learn_video_plays ----------------------------------------------------
create table if not exists public.learn_video_plays (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.learn_videos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists learn_video_plays_video_idx
  on public.learn_video_plays(video_id);
create index if not exists learn_video_plays_video_user_idx
  on public.learn_video_plays(video_id, user_id);

alter table public.learn_video_plays enable row level security;

drop policy if exists "auth read learn_video_plays"     on public.learn_video_plays;
drop policy if exists "auth insert own learn_video_play" on public.learn_video_plays;

-- Anyone signed in can see the counts (they're displayed on the card).
create policy "auth read learn_video_plays"
  on public.learn_video_plays for select to authenticated using (true);

-- A user may only record their own play. No update/delete - this is an
-- append-only event log.
create policy "auth insert own learn_video_play"
  on public.learn_video_plays for insert to authenticated
  with check (auth.uid() = user_id);

-- 3. learn_resources ------------------------------------------------------
create table if not exists public.learn_resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  url          text not null,
  description  text,
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists learn_resources_created_idx
  on public.learn_resources(created_at desc);

alter table public.learn_resources enable row level security;

drop policy if exists "auth read learn_resources"        on public.learn_resources;
drop policy if exists "auth insert learn_resources"      on public.learn_resources;
drop policy if exists "author or admin delete learn_resources" on public.learn_resources;

create policy "auth read learn_resources"
  on public.learn_resources for select to authenticated using (true);

-- Any signed-in user can add a resource; added_by must be themselves.
create policy "auth insert learn_resources"
  on public.learn_resources for insert to authenticated
  with check (auth.uid() = added_by);

-- The original poster, or any super_admin, can remove a resource.
create policy "author or admin delete learn_resources"
  on public.learn_resources for delete to authenticated
  using (
    auth.uid() = added_by
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );
