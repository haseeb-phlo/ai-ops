-- Let AI initiatives join the roadmap's prioritised queue alongside
-- suggestions. Queue membership for an initiative is: status 'paused',
-- shipped_at null, queue_rank set. Ranks share one number line with
-- intervention_suggestions.queue_rank - every reorder renumbers the merged
-- queue 1..n, so the two tables can't collide for long and stale ranks on
-- rows outside the queue are ignored by every reader.

alter table "public"."ai_interventions"
  add column "queue_rank" integer;

comment on column "public"."ai_interventions"."queue_rank" is
  'Priority order within the roadmap''s Queued lane, shared with intervention_suggestions.queue_rank (1 = next up). Only meaningful while paused and unshipped; null otherwise.';
