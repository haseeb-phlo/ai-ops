-- Add an explicit ordering column to learn_videos so super-admins can
-- curate the order videos appear in on the Learn page (drag-to-reorder).
--
-- Position is GLOBAL across all topics/subtopics, not scoped per bucket.
-- The Learn page groups rows by topic -> subtopic after sorting by
-- position, so a single global order is sufficient and, crucially, means
-- editVideo can move a video between topics without any position fixups —
-- it simply sorts into its new bucket wherever its global position lands.
--
-- Lower position = earlier in the list. Existing rows are backfilled to
-- preserve today's "newest first" order (created_at DESC) so nothing
-- visibly reshuffles on deploy.

alter table "public"."learn_videos"
  add column "position" integer not null default 0;

with ordered as (
  select id, row_number() over (order by created_at desc) as rn
  from "public"."learn_videos"
)
update "public"."learn_videos" v
set "position" = ordered.rn
from ordered
where ordered.id = v.id;

-- New videos get max(position)+1 in the addVideo Server Action so they
-- land at the end; the default 0 is just a safety net for any other path.
create index if not exists "learn_videos_position_idx"
  on "public"."learn_videos" ("position");
