import { PlayIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { fetchLoomOembed } from "@/lib/loom";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AddVideoDialog } from "./_components/add-video-dialog";
import { VideoCard, type VideoAttachment } from "./_components/video-card";
import {
  SortableVideoGrid,
  type SortableItem,
} from "./_components/sortable-video-grid";
import { YourProgress } from "./_components/your-progress";
import { ProgrammeBanner } from "./_components/programme-banner";
import { BaselineGateCard } from "./track/_components/baseline-gate-card";
import { loadTrackState } from "@/lib/programme/track-data";
import {
  LEARN_SUBTOPICS,
  LEARN_SUBTOPIC_LABEL,
  LEARN_TOPICS,
  LEARN_TOPIC_LABEL,
  type LearnSubtopic,
  type LearnTopic,
} from "./topics";

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  loom_share_url: string;
  loom_embed_id: string;
  topic: LearnTopic | null;
  subtopic: LearnSubtopic | null;
  thumbnail_url: string | null;
  added_by: string | null;
  created_at: string;
  position: number;
};

type PlayRow = { video_id: string; user_id: string; created_at: string };

type CompletionRow = { video_id: string; user_id: string };

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

export default async function LearnPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  // Null for anyone not enrolled in a live cohort, which is most people until
  // their cohort starts - Learn stays an open library for them.
  const track = await loadTrackState(user.id, user.email);

  const [
    { data: videos },
    { data: plays },
    { data: completionRows },
    { data: resources },
  ] = await Promise.all([
    supabase
      .from("learn_videos")
      .select(
        "id, title, description, loom_share_url, loom_embed_id, topic, subtopic, thumbnail_url, added_by, created_at, position",
      )
      .order("position", { ascending: true })
      .order("created_at", { ascending: false })
      .returns<VideoRow[]>(),
    supabase
      .from("learn_video_plays")
      .select("video_id, user_id, created_at")
      .returns<PlayRow[]>(),
    supabase
      .from("learn_video_completions")
      .select("video_id, user_id")
      .eq("user_id", user.id)
      .returns<CompletionRow[]>(),
    supabase
      .from("learn_video_resources")
      .select("id, video_id, kind, title, url, file_name, file_size, created_at")
      .order("created_at", { ascending: true })
      .returns<ResourceRow[]>(),
  ]);

  // Ask Loom's oEmbed endpoint for each video's duration (not persisted in
  // the DB; the fetch is cached for a week per URL so this is cheap after
  // the first render) and, in the same pass, backfill thumbnail_url for any
  // rows that don't have one yet - older videos predate the column. The
  // updates fire in parallel and we patch the in-memory rows so the current
  // render shows thumbnails immediately. Failures are silent - the gradient
  // placeholder still covers the play surface and the duration chip is
  // simply omitted.
  const videoRowsMutable = videos ?? [];
  const durationByVideo = new Map<string, number>();
  await Promise.all(
    videoRowsMutable.map(async (v) => {
      const { thumbnailUrl, durationSeconds } = await fetchLoomOembed(
        v.loom_share_url,
      );
      if (durationSeconds != null) durationByVideo.set(v.id, durationSeconds);
      if (v.thumbnail_url || !thumbnailUrl) return;
      v.thumbnail_url = thumbnailUrl;
      await supabase
        .from("learn_videos")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("id", v.id);
    }),
  );

  // Aggregate plays per video. We track both totals (every play, including
  // rewatches) and uniques (distinct viewers) so the card can show
  // "X plays from Y people". In the same pass, capture the current user's
  // earliest play timestamp per video so the card can show a "watched on X"
  // indicator. "Watched" today means "clicked play at least once" — good
  // enough until/unless we wire the Loom SDK for true completion.
  const totalPlays = new Map<string, number>();
  const uniqueViewers = new Map<string, Set<string>>();
  const myWatchedAt = new Map<string, string>();
  for (const p of plays ?? []) {
    totalPlays.set(p.video_id, (totalPlays.get(p.video_id) ?? 0) + 1);
    let set = uniqueViewers.get(p.video_id);
    if (!set) {
      set = new Set();
      uniqueViewers.set(p.video_id, set);
    }
    set.add(p.user_id);
    if (p.user_id === user.id) {
      const existing = myWatchedAt.get(p.video_id);
      if (!existing || p.created_at < existing) {
        myWatchedAt.set(p.video_id, p.created_at);
      }
    }
  }

  // The current user's explicit "completed" marks. The query already
  // filters to user.id, so every row here is the caller's own.
  const myCompletedVideoIds = new Set<string>();
  for (const c of completionRows ?? []) myCompletedVideoIds.add(c.video_id);

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
  const videoRows = videoRowsMutable;

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

  const toItem = (v: VideoRow): SortableItem => ({
    id: v.id,
    title: v.title,
    node: (
      <VideoCard
        id={v.id}
        title={v.title}
        description={v.description}
        loomEmbedId={v.loom_embed_id}
        loomShareUrl={v.loom_share_url}
        thumbnailUrl={v.thumbnail_url}
        topic={v.topic}
        subtopic={v.subtopic}
        durationSeconds={durationByVideo.get(v.id) ?? null}
        totalPlays={totalPlays.get(v.id) ?? 0}
        uniqueViewers={uniqueViewers.get(v.id)?.size ?? 0}
        watchedAt={myWatchedAt.get(v.id) ?? null}
        isCompleted={myCompletedVideoIds.has(v.id)}
        canManage={canManageVideos}
        attachments={attachmentsByVideo.get(v.id) ?? []}
      />
    ),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Learn"
        description="Short Loom walkthroughs and supporting materials for getting better at AI."
        actions={canManageVideos ? <AddVideoDialog /> : null}
      />

      {track &&
        (track.hasBaseline ? (
          <ProgrammeBanner
            cohortName={track.cohort.name}
            completed={track.gates.g1.current}
            total={track.gates.g1.target}
            rag={track.rag}
            outstandingCount={track.outstandingCount}
          />
        ) : (
          <BaselineGateCard compact />
        ))}

      <YourProgress
        completed={myCompletedVideoIds.size}
        watched={myWatchedAt.size}
        total={videoRows.length}
      />

      {canManageVideos && videoRows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag to reorder within a topic — use Edit to move a video to another
          topic.
        </p>
      )}

      {videoRows.length === 0 ? (
        <EmptyState
          icon={<PlayIcon aria-hidden />}
          title="No videos yet"
          description="Short Loom walkthroughs will appear here once they're added."
          action={canManageVideos ? <AddVideoDialog /> : undefined}
        />
      ) : (
      <div className="space-y-10">
        {LEARN_TOPICS.map((topic) => {
          const items = videosByTopic.get(topic) ?? [];
          const subtopicKeys = LEARN_SUBTOPICS[topic] ?? [];

          // Empty topics are only interesting to admins (who can fill
          // them); everyone else just sees the topics that have content.
          if (items.length === 0 && !canManageVideos) return null;

          // When a topic defines subtopics, split its videos into a
          // default (no-subtopic) bucket plus one bucket per defined
          // subtopic. Rows whose subtopic isn't in the parent topic's
          // list fall back into the default bucket so they remain
          // visible after a subtopic gets removed from the config.
          const defaultBucket: VideoRow[] = [];
          const bySubtopic = new Map<string, VideoRow[]>();
          for (const s of subtopicKeys) bySubtopic.set(s, []);
          for (const v of items) {
            if (v.subtopic && bySubtopic.has(v.subtopic)) {
              bySubtopic.get(v.subtopic)!.push(v);
            } else {
              defaultBucket.push(v);
            }
          }

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
                <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background px-6 py-4 text-xs text-muted-foreground">
                  <span>No videos in this topic yet.</span>
                  <AddVideoDialog
                    defaultTopic={topic}
                    trigger={
                      <Button type="button" variant="outline" size="sm">
                        Add video
                      </Button>
                    }
                  />
                </div>
              ) : subtopicKeys.length === 0 ? (
                <SortableVideoGrid
                  items={items.map(toItem)}
                  canManage={canManageVideos}
                />
              ) : (
                <div className="space-y-6">
                  {defaultBucket.length > 0 && (
                    <SortableVideoGrid
                      items={defaultBucket.map(toItem)}
                      canManage={canManageVideos}
                    />
                  )}
                  {subtopicKeys.map((s) => {
                    const subItems = bySubtopic.get(s) ?? [];
                    if (subItems.length === 0) return null;
                    return (
                      <div key={s} className="space-y-3">
                        <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
                          {LEARN_SUBTOPIC_LABEL[s] ?? s}
                        </h3>
                        <SortableVideoGrid
                          items={subItems.map(toItem)}
                          canManage={canManageVideos}
                        />
                      </div>
                    );
                  })}
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
            <SortableVideoGrid
              items={uncategorized.map(toItem)}
              canManage={canManageVideos}
            />
          </section>
        )}
      </div>
      )}
    </PageContainer>
  );
}
