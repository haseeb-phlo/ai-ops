-- =========================================================================
-- Phlo AI Ops - Learn videos: thumbnails + subtopic (additive)
-- Run AFTER learn_migration.sql + learn_video_topics_migration.sql.
-- Safe to re-run.
-- =========================================================================
-- Adds two columns to learn_videos:
--   thumbnail_url - Loom's oEmbed-reported thumbnail. Persisted at add/edit
--                   time so we don't re-fetch on every render. Nullable;
--                   missing rows are backfilled on first page render.
--   subtopic      - free-form text constrained by topic+subtopic combos.
--                   Currently AI Tools has Claude as its only subtopic.

alter table public.learn_videos
  add column if not exists thumbnail_url text;

alter table public.learn_videos
  add column if not exists subtopic text;

alter table public.learn_videos
  drop constraint if exists learn_videos_subtopic_check;

alter table public.learn_videos
  add constraint learn_videos_subtopic_check
       check (
         subtopic is null
         or (topic = 'ai_tools' and subtopic in ('claude'))
       );

create index if not exists learn_videos_subtopic_idx
  on public.learn_videos(topic, subtopic);
