-- =========================================================================
-- Phlo AI Ops - Learn videos subtopic column (additive)
-- Run AFTER learn_video_topics_migration.sql. Safe to re-run.
-- =========================================================================
-- Adds a nullable subtopic column to learn_videos so videos under a parent
-- topic (currently just "ai_tools") can be grouped under finer-grained
-- headings. The DB only validates membership in the global subtopic list;
-- the topic→subtopic relationship is enforced in the Server Action so the
-- list of valid combinations stays in TypeScript alongside the UI.

alter table public.learn_videos
  add column if not exists subtopic text;

alter table public.learn_videos
  drop constraint if exists learn_videos_subtopic_check;
alter table public.learn_videos
  add constraint learn_videos_subtopic_check
       check (subtopic is null or subtopic in (
         'claude'
       ));

create index if not exists learn_videos_subtopic_idx
  on public.learn_videos(subtopic);
