import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { AddVideoDialog } from "./_components/add-video-dialog";
import { VideoCard, type VideoAttachment } from "./_components/video-card";
import { LEARN_TOPICS, LEARN_TOPIC_LABEL, type LearnTopic } from "./topics";

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  loom_share_url: string;
  loom_embed_id: string;
  topic: LearnTopic | null;
  added_by: string | null;
  created_at: string;
};

type PlayRow = { video_id: string; user_id: string };

type ResourceRow = {
  id: string;
  video_id: string;
  kind: "url" | "file";
  title: string;
  url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

type ProfileLite = { user_id: string; display_name: string | null };

export default async function LearnPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [{ data: videos }, { data: plays }, { data: resources }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("learn_videos")
        .select(
          "id, title, description, loom_share_url, loom_embed_id, topic, added_by, created_at",
        )
        .order("created_at", { ascending: false })
        .returns<VideoRow[]>(),
      supabase
        .from("learn_video_plays")
        .select("video_id, user_id")
        .returns<PlayRow[]>(),
      supabase
        .from("learn_video_resources")
        .select("id, video_id, kind, title, url, file_name, file_size, created_at")
        .order("created_at", { ascending: true })
        .returns<ResourceRow[]>(),
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .returns<ProfileLite[]>(),
    ]);

  const nameByUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    const dn = p.display_name?.trim();
    if (dn) nameByUserId.set(p.user_id, dn);
  }

  // Aggregate plays per video. We track both totals (every play, including
  // rewatches) and uniques (distinct viewers) so the card can show
  // "X plays from Y people".
  const totalPlays = new Map<string, number>();
  const uniqueViewers = new Map<string, Set<string>>();
  for (const p of plays ?? []) {
    totalPlays.set(p.video_id, (totalPlays.get(p.video_id) ?? 0) + 1);
    let set = uniqueViewers.get(p.video_id);
    if (!set) {
      set = new Set();
      uniqueViewers.set(p.video_id, set);
    }
    set.add(p.user_id);
  }

  const attachmentsByVideo = new Map<string, VideoAttachment[]>();
  for (const r of resources ?? []) {
    let list = attachmentsByVideo.get(r.video_id);
    if (!list) {
      list = [];
      attachmentsByVideo.set(r.video_id, list);
    }
    list.push({
      id: r.id,
      kind: r.kind,
      title: r.title,
      url: r.url,
      fileName: r.file_name,
      fileSize: r.file_size,
    });
  }

  const canManageVideos = user.realRole === "super_admin";
  const videoRows = videos ?? [];

  // Group videos by topic. Each fixed topic gets its own section in the
  // order declared in actions.ts; legacy rows without a topic surface under
  // "Uncategorized" so they're still discoverable.
  const videosByTopic = new Map<LearnTopic, VideoRow[]>();
  for (const t of LEARN_TOPICS) videosByTopic.set(t, []);
  const uncategorized: VideoRow[] = [];
  for (const v of videoRows) {
    if (v.topic && videosByTopic.has(v.topic)) {
      videosByTopic.get(v.topic)!.push(v);
    } else {
      uncategorized.push(v);
    }
  }

  const renderCard = (v: VideoRow) => (
    <VideoCard
      key={v.id}
      id={v.id}
      title={v.title}
      description={v.description}
      loomEmbedId={v.loom_embed_id}
      loomShareUrl={v.loom_share_url}
      topic={v.topic}
      addedByName={
        (v.added_by && nameByUserId.get(v.added_by)) || "Unknown"
      }
      createdAt={v.created_at}
      totalPlays={totalPlays.get(v.id) ?? 0}
      uniqueViewers={uniqueViewers.get(v.id)?.size ?? 0}
      canManage={canManageVideos}
      attachments={attachmentsByVideo.get(v.id) ?? []}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Learn"
        description="Short Loom walkthroughs and supporting materials for getting better at AI."
        actions={canManageVideos ? <AddVideoDialog /> : null}
      />

      <div className="space-y-10">
        {LEARN_TOPICS.map((topic) => {
          const items = videosByTopic.get(topic) ?? [];
          return (
            <section key={topic} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {LEARN_TOPIC_LABEL[topic]}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length} {items.length === 1 ? "video" : "videos"}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-6 py-8 text-center text-xs text-muted-foreground">
                  No videos in this topic yet.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(renderCard)}
                </div>
              )}
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Uncategorized
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {uncategorized.length}{" "}
                {uncategorized.length === 1 ? "video" : "videos"}
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {uncategorized.map(renderCard)}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
