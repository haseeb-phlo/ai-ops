-- Per-user "mark as completed" signal for Learn videos.
--
-- This is distinct from learn_video_plays: a play is an automatic, one-way
-- event recorded the first time a user clicks play. A completion is an
-- explicit, intentional "I've finished this" that the user toggles on and
-- off via a checkbox on the video card. One row per (video, user); the
-- toggle action inserts to complete and deletes to un-complete, so the
-- unique constraint also guards against a double-insert race.
--
-- RLS mirrors learn_video_reactions: any authenticated user can read all
-- rows (so we could surface "N people completed this" later), but a user
-- may only insert/delete their own row.

create table if not exists "public"."learn_video_completions" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "video_id" "uuid" not null,
    "user_id" "uuid" not null,
    "created_at" timestamp with time zone default "now"() not null
);

alter table "public"."learn_video_completions" owner to "postgres";

alter table only "public"."learn_video_completions"
    add constraint "learn_video_completions_pkey" primary key ("id");

alter table only "public"."learn_video_completions"
    add constraint "learn_video_completions_video_id_user_id_key" unique ("video_id", "user_id");

alter table only "public"."learn_video_completions"
    add constraint "learn_video_completions_video_id_fkey" foreign key ("video_id") references "public"."learn_videos"("id") on delete cascade;

alter table only "public"."learn_video_completions"
    add constraint "learn_video_completions_user_id_fkey" foreign key ("user_id") references "auth"."users"("id") on delete cascade;

create index if not exists "learn_video_completions_video_user_idx"
    on "public"."learn_video_completions" using "btree" ("video_id", "user_id");

alter table "public"."learn_video_completions" enable row level security;

create policy "auth read learn_video_completions" on "public"."learn_video_completions"
    for select to "authenticated" using (true);

create policy "auth insert own learn_video_completion" on "public"."learn_video_completions"
    for insert to "authenticated" with check (("auth"."uid"() = "user_id"));

create policy "auth delete own learn_video_completion" on "public"."learn_video_completions"
    for delete to "authenticated" using (("auth"."uid"() = "user_id"));

grant references, trigger, truncate, maintain on table "public"."learn_video_completions" to "anon";
grant all on table "public"."learn_video_completions" to "authenticated";
grant select, references, trigger, truncate, maintain on table "public"."learn_video_completions" to "service_role";
