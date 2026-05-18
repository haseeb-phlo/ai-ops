-- =========================================================================
-- Phlo AI Ops - Per-video attachments on Learn videos
-- Run AFTER learn_migration.sql. Safe to re-run.
-- =========================================================================
-- Replaces the global `learn_resources` surface (still in the DB for data
-- preservation, just no longer shown in the UI) with per-video attachments.
-- Each video can have a list of URL links and/or uploaded files (PDFs,
-- images, docs) curated by super admins.
--
-- Files live in a private 'learn-video-resources' bucket; downloads are
-- minted as short-lived signed URLs from the Server Action.

-- 1. learn_video_resources ------------------------------------------------
create table if not exists public.learn_video_resources (
  id           uuid primary key default gen_random_uuid(),
  video_id     uuid not null references public.learn_videos(id) on delete cascade,
  -- 'url' = external link; 'file' = object in the private bucket below.
  kind         text not null check (kind in ('url', 'file')),
  title        text not null,
  -- Populated when kind = 'url'.
  url          text,
  -- Populated when kind = 'file'. Path inside the bucket (e.g.
  -- "<video_id>/<uuid>-<safe-filename>"). The bucket is private; the UI
  -- mints a signed URL on click.
  storage_path text,
  file_name    text,
  file_size    bigint,
  file_mime    text,
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Shape integrity: kind dictates which payload columns are populated.
  constraint learn_video_resources_kind_payload check (
    (kind = 'url'  and url is not null and storage_path is null)
    or
    (kind = 'file' and storage_path is not null and url is null)
  )
);

create index if not exists learn_video_resources_video_idx
  on public.learn_video_resources(video_id, created_at desc);

alter table public.learn_video_resources enable row level security;

drop policy if exists "auth read learn_video_resources"         on public.learn_video_resources;
drop policy if exists "super_admin write learn_video_resources" on public.learn_video_resources;

-- Anyone signed in can see attachments.
create policy "auth read learn_video_resources"
  on public.learn_video_resources for select to authenticated using (true);

-- Only super admins can add/update/delete attachments.
create policy "super_admin write learn_video_resources"
  on public.learn_video_resources for all to authenticated
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

-- 2. Private storage bucket ----------------------------------------------
insert into storage.buckets (id, name, public)
values ('learn-video-resources', 'learn-video-resources', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "learn-video-resources read auth"         on storage.objects;
drop policy if exists "learn-video-resources write super_admin" on storage.objects;

-- Authenticated users can read objects (signed URLs are still required to
-- actually download from a private bucket, but the read RLS is what lets
-- the signing route validate access).
create policy "learn-video-resources read auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'learn-video-resources');

-- Only super admins can write/update/delete objects in this bucket.
create policy "learn-video-resources write super_admin"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'learn-video-resources'
    and exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  )
  with check (
    bucket_id = 'learn-video-resources'
    and exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );
