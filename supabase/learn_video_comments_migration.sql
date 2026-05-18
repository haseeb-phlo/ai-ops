-- =========================================================================
-- Phlo AI Ops - comments on Learn videos (additive)
--
-- Lightweight discussion thread on each video. Anyone authenticated can
-- read + post; comment authors can delete their own; super-admins can
-- delete any so spam / drift can be cleaned up.
--
-- Run AFTER learn_migration.sql. Safe to re-run.
-- =========================================================================

create table if not exists public.learn_video_comments (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.learn_videos(id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists learn_video_comments_video_idx
  on public.learn_video_comments (video_id, created_at desc);

alter table public.learn_video_comments enable row level security;

drop policy if exists "lvc_read"        on public.learn_video_comments;
drop policy if exists "lvc_insert_self" on public.learn_video_comments;
drop policy if exists "lvc_delete_priv" on public.learn_video_comments;

create policy "lvc_read"
  on public.learn_video_comments for select
  to authenticated using (true);

create policy "lvc_insert_self"
  on public.learn_video_comments for insert
  to authenticated with check (created_by = auth.uid());

-- Author OR super_admin can delete.
create policy "lvc_delete_priv"
  on public.learn_video_comments for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

notify pgrst, 'reload schema';
