-- Learn videos are no longer Loom-only.
--
-- The library was built when Loom was the only place a Phlo recording lived,
-- so the schema named the host rather than the thing: `loom_share_url` and
-- `loom_embed_id`. Day 3's video arrived on Streamable and the columns had to
-- stop meaning "Loom".
--
-- EXPAND ONLY - the two columns keep their names on purpose. Renaming them
-- would leave a window between `supabase db push` and the Vercel deploy in
-- which the running app selects a column that no longer exists, and every
-- Learn page 500s for as long as that takes. The names are wrong; a broken
-- library is worse. `comment on column` is where that is recorded, so the next
-- person reads it from the schema rather than guessing.

alter table public.learn_videos
  add column if not exists provider text not null default 'loom';

-- Null for provider='link': a host we do not recognise has no id to extract,
-- and the share URL is the only handle on it. Safe to relax - nothing in the
-- deployed app writes this column without also writing a value.
alter table public.learn_videos
  alter column loom_embed_id drop not null;

-- Belt and braces on the pair: an id is required for every provider that
-- embeds, and must be absent for the one that cannot.
alter table public.learn_videos
  add constraint learn_videos_embed_id_matches_provider
  check (
    (provider = 'link' and loom_embed_id is null)
    or (provider <> 'link' and loom_embed_id is not null)
  );

comment on column public.learn_videos.provider is
  'Which host the video lives on: ''loom'', ''streamable'', or ''link'' for a URL we can store and open but not embed. Read by lib/video.ts, which owns the registry of what each provider embeds and where its thumbnail comes from.';

comment on column public.learn_videos.loom_share_url is
  'The URL an admin pasted, whatever the host - NOT necessarily Loom. Named before there was more than one provider; see the migration that added `provider` for why it was not renamed.';

comment on column public.learn_videos.loom_embed_id is
  'The provider-specific video id, or null when provider=''link''. NOT necessarily a Loom id - same naming story as loom_share_url.';

comment on column public.learn_videos.thumbnail_url is
  'Resolved once at write time, never at render. Some hosts only publish a thumbnail behind an expiring signature (Streamable''s og:image carries a CloudFront Expires of about an hour), so lib/video.ts strips the signing parameters before this is stored - otherwise the poster frame silently 403s a day later.';
