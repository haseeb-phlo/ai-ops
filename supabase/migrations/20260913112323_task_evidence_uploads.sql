-- Screenshots filed against a day's Task.
--
-- The programme collects one piece of evidence per member per day, and until
-- now the only field was a URL. Day 7 is where that broke: a Claude scheduled
-- task has runs but no Share link, so a member who did the work had nothing
-- to paste and could not complete the day. A screenshot is the honest answer
-- there, and on any other day whose output is a file rather than a page.
--
-- The blob lives here; the row that points at it is the member's own
-- `programme_item_progress.meta_json` (key `output_file`), beside the
-- `output_url` it replaces. See lib/programme/task-link.ts.
--
-- PRIVATE BUCKET. These are screenshots of members' real work - inboxes,
-- rotas, patient-adjacent spreadsheets - so nothing here is world-readable.
-- Reads go through a signed URL minted for a caller who has already passed
-- the policy below.
--
-- The path is `<cohort_member_id>/<track_item_id>/<uuid>`, WITHOUT a file
-- extension. That is not tidiness: the app serves these through
-- /learn/track/evidence/<path>, and proxy.ts's matcher excludes anything
-- ending .png/.jpg/.webp from the auth gate, so an extension in the path
-- would hand that route an unrefreshed session and break the image for
-- anyone whose token was due a refresh. The content type is stored on the
-- object instead, and the original filename in meta_json.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'programme-task-evidence',
    'programme-task-evidence',
    false,
    10485760, -- 10 MB. A screenshot that does not fit is a video.
    array[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        -- Straight off an iPhone, which is where a lot of these will come
        -- from. Browsers cannot render HEIC, so the card falls back to a
        -- download link rather than a preview - still better than no field.
        'image/heic',
        'image/heif'
    ]
)
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Which member a given object belongs to, read off the first path segment.
--
-- A function rather than an inline `(storage.foldername(name))[1]::uuid` in
-- each policy, because that cast RAISES on a path whose first segment is not
-- a uuid - and a policy that errors instead of returning false turns a
-- crafted request into a 500. This returns null there, and both helpers below
-- answer false for null.
create or replace function "public"."task_evidence_member_id"("object_name" "text")
    returns "uuid"
    language "sql" immutable
    as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
  end;
$$;

alter function "public"."task_evidence_member_id"("text") owner to "postgres";

-- Same visibility as the progress row that points at the object: the member,
-- their team lead, and super admins. `can_view_cohort_member` is the helper
-- every other programme table's read policy uses, so a screenshot can never
-- be reachable by someone who could not already read the row naming it.
drop policy if exists "read own or led task evidence" on "storage"."objects";
create policy "read own or led task evidence" on "storage"."objects"
    for select to "authenticated"
    using (
        "bucket_id" = 'programme-task-evidence'
        and "public"."can_view_cohort_member"("public"."task_evidence_member_id"("name"))
    );

-- Writes are the narrower helper - a lead can read a member's evidence but
-- must not be able to file it for them, exactly as on programme_item_progress.
drop policy if exists "write own task evidence" on "storage"."objects";
create policy "write own task evidence" on "storage"."objects"
    for insert to "authenticated"
    with check (
        "bucket_id" = 'programme-task-evidence'
        and "public"."owns_cohort_member"("public"."task_evidence_member_id"("name"))
    );

-- Replacing a screenshot uploads a new object and deletes the old one, so the
-- member needs delete on their own. Super admins too, for cleanup.
drop policy if exists "delete own task evidence" on "storage"."objects";
create policy "delete own task evidence" on "storage"."objects"
    for delete to "authenticated"
    using (
        "bucket_id" = 'programme-task-evidence'
        and (
            "public"."owns_cohort_member"("public"."task_evidence_member_id"("name"))
            or "public"."is_super_admin"()
        )
    );
