-- Roadmap queue: promote the roadmap to a first-class surface with a
-- prioritised queue.
--
-- 1) New 'queued' suggestion status between 'accepted' and 'in_progress'.
--    Semantics: accepted = committed but not yet prioritised; queued =
--    prioritised into the build queue (ordered); in_progress = underway.
--    The champion guardrail needs no change: the
--    enforce_suggestion_status_transition trigger allowlists champions to
--    'under_review'/'declined' only, so 'queued' is super-admin-only by
--    construction, and non-super INSERTs are still forced to 'open'.
--
-- 2) queue_rank orders cards inside the Queued lane (1 = build next).
--    Reordering renumbers the whole queue 1..n server-side, so the value is
--    a plain integer, null for rows outside the queue (and for queued rows
--    never explicitly ordered - those sort after ranked ones, oldest first).

alter table "public"."intervention_suggestions"
  drop constraint "intervention_suggestions_status_check";

alter table "public"."intervention_suggestions"
  add constraint "intervention_suggestions_status_check"
  check (("status" = any (array['open'::"text", 'under_review'::"text", 'accepted'::"text", 'queued'::"text", 'in_progress'::"text", 'declined'::"text", 'shipped'::"text"])));

alter table "public"."intervention_suggestions"
  add column "queue_rank" integer;

comment on column "public"."intervention_suggestions"."queue_rank" is
  'Priority order within the roadmap''s Queued lane (1 = next up). Null outside the queue; renumbered 1..n on every reorder.';
