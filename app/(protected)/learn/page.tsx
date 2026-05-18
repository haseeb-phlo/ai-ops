import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { AddVideoDialog } from "./_components/add-video-dialog";
import { AddResourceDialog } from "./_components/add-resource-dialog";
import { VideoCard } from "./_components/video-card";
import { ResourceRow } from "./_components/resource-row";
import { LEARN_TOPICS, LEARN_TOPIC_LABEL, type LearnTopic } from "./actions";

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

type ResourceRowDb = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  added_by: string | null;
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
        .from("learn_resources")
        .select("id, title, url, description, added_by, created_at")
        .order("created_at", { ascending: false })
        .returns<ResourceRowDb[]>(),
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

  const canManageVideos = user.realRole === "super_admin";
  const videoRows = videos ?? [];
  const resourceRows = resources ?? [];

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
      addedByName={
        (v.added_by && nameByUserId.get(v.added_by)) || "Unknown"
      }
      createdAt={v.created_at}
      totalPlays={totalPlays.get(v.id) ?? 0}
      uniqueViewers={uniqueViewers.get(v.id)?.size ?? 0}
      canDelete={canManageVideos}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Learn"
        description="Short Loom walkthroughs and external resources for getting better at AI."
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

      <section className="space-y-3 border-t border-border pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Additional Resources
            </h2>
            <p className="text-sm text-muted-foreground">
              Articles, docs, courses - anything worth bookmarking. Anyone can add.
            </p>
          </div>
          <AddResourceDialog />
        </div>

        <div className="rounded-lg border border-border bg-background">
          {resourceRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No resources yet. Be the first to share something.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {resourceRows.map((r) => (
                <ResourceRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  url={r.url}
                  description={r.description}
                  addedByName={
                    (r.added_by && nameByUserId.get(r.added_by)) || "Unknown"
                  }
                  createdAt={r.created_at}
                  canDelete={
                    canManageVideos || r.added_by === user.id
                  }
                  formattedDate={format(new Date(r.created_at), "d MMM yyyy")}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
