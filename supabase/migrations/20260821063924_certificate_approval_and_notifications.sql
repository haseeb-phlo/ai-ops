-- Certificate approval, and single-send bookkeeping for notifications.
--
-- CERTIFICATE APPROVAL. Passing all four gates now means "earned", not
-- "issued". An admin reviews and approves before the certificate appears and
-- before anything is announced. Two separate facts, so two separate columns:
--
--   completed_at          - the member met every gate. Latched, never cleared.
--   certificate_issued_at - an admin approved it. What the certificate and the
--                           congratulation are gated on.
--
-- Keeping them apart matters because they answer different questions.
-- Reporting wants "how many finished the programme"; the member wants "is my
-- certificate ready". Collapsing them into one column would make an admin's
-- review backlog look like people not finishing.
--
-- NOTIFICATION SENDS. A cron that DMs a hundred people must be safe to retry.
-- Every send claims a key first; a second attempt hits the unique constraint
-- and stops. Same pattern as digest_sends, which the fortnightly digest uses.

alter table "public"."programme_cohort_members"
  add column if not exists "certificate_issued_at" timestamp with time zone,
  add column if not exists "certificate_issued_by" "uuid"
    references "auth"."users"("id") on delete set null,
  add column if not exists "certificate_declined_at" timestamp with time zone,
  add column if not exists "certificate_note" "text";

comment on column "public"."programme_cohort_members"."completed_at" is
  'When every gate was met. Latched: never cleared, so a later data correction cannot revoke a certificate already earned.';
comment on column "public"."programme_cohort_members"."certificate_issued_at" is
  'When an admin approved the certificate. The certificate view and the completion announcement are gated on this, not on completed_at.';

-- Finding the approval queue is the admin dashboard's most frequent query.
create index if not exists "programme_cohort_members_awaiting_certificate_idx"
  on "public"."programme_cohort_members" ("completed_at")
  where ("completed_at" is not null and "certificate_issued_at" is null
         and "certificate_declined_at" is null);

-- =========================================================================
-- Notification bookkeeping
-- =========================================================================
-- One row per (kind, recipient, period). Claiming before sending makes a
-- retried or double-fired cron a no-op rather than a second DM.

create table if not exists "public"."programme_notification_sends" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "kind" "text" not null,
    -- Who it went to. Null for a channel post, which has no single recipient.
    "user_id" "uuid",
    -- Scopes the claim: an ISO week for a weekly digest, a cohort id plus date
    -- for a channel post, the member id for a one-off like the day-90 nudge.
    "period_key" "text" not null,
    "channel" "text",
    "sent_at" timestamp with time zone default "now"() not null,
    "succeeded" boolean default true not null,
    "detail" "text",
    constraint "programme_notification_sends_kind_check" check (("kind" = any (array[
        'member_reminder'::"text",
        'lead_digest'::"text",
        'cohort_summary'::"text",
        'signoff_rejected'::"text",
        'certificate_issued'::"text",
        'day_90_nudge'::"text"])))
);

alter table "public"."programme_notification_sends" owner to "postgres";

alter table only "public"."programme_notification_sends"
    add constraint "programme_notification_sends_pkey" primary key ("id");

-- The claim. A repeat send for the same kind, person and period conflicts.
create unique index if not exists "programme_notification_sends_claim_key"
    on "public"."programme_notification_sends"
    ("kind", coalesce("user_id"::"text", ''), "period_key");

alter table "public"."programme_notification_sends" enable row level security;

-- Operational bookkeeping, not member data: admins can read it, nobody else
-- needs to, and only the service-role cron writes it.
create policy "super_admin read programme_notification_sends"
    on "public"."programme_notification_sends"
    for select to "authenticated" using ("public"."is_super_admin"());

grant references, trigger, truncate, maintain on table "public"."programme_notification_sends" to "anon";
grant select on table "public"."programme_notification_sends" to "authenticated";
grant all on table "public"."programme_notification_sends" to "service_role";

-- =========================================================================
-- Slack user ids
-- =========================================================================
-- Cached so a weekly DM run is one Slack API call per person instead of a
-- lookup every time. Nullable and lazily filled; a null just means "look it
-- up next time", never "this person has no Slack".

alter table "public"."profiles"
  add column if not exists "slack_user_id" "text";

comment on column "public"."profiles"."slack_user_id" is
  'Cached Slack member id, resolved from email via users.lookupByEmail. Null means not yet resolved, not absent.';
