-- =========================================================================
-- Phlo AI Ops - Learn videos topic column (additive)
-- Run AFTER learn_migration.sql. Safe to re-run.
-- =========================================================================
-- Adds a topic column to learn_videos so videos can be grouped under fixed
-- headings on the Learn tab. Topic is nullable to keep this migration safe
-- to apply on an existing table; new inserts go through the Server Action,
-- which requires one of the four values below. NULL rows surface in an
-- "Uncategorized" section in the UI until an admin assigns a topic.

alter table public.learn_videos
  add column if not exists topic text;

alter table public.learn_videos
  drop constraint if exists learn_videos_topic_check;
alter table public.learn_videos
  add constraint learn_videos_topic_check
       check (topic is null or topic in (
         'ai_ops',
         'ai_foundations',
         'prompt_engineering',
         'ai_tools'
       ));

create index if not exists learn_videos_topic_idx
  on public.learn_videos(topic);
