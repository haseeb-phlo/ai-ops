"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  PlayIcon,
  TrashIcon,
  FileIcon,
  LinkIcon,
  PlusIcon,
  CheckIcon,
} from "lucide-react";
import { loomEmbedUrl } from "@/lib/loom";
import {
  deleteVideo,
  deleteVideoResource,
  recordPlay,
  signedUrlForResource,
  toggleVideoCompletion,
} from "../actions";
import { type LearnSubtopic, type LearnTopic } from "../topics";
import { AddAttachmentDialog } from "./add-attachment-dialog";
import { EditVideoDialog } from "./edit-video-dialog";
import { Reactions, type ReactionEntry } from "./reactions";
import { Comments, type VideoComment } from "./comments";

export type VideoAttachment = {
  id: string;
  kind: "url" | "file";
  title: string;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
};

export function VideoCard({
  id,
  title,
  description,
  loomEmbedId,
  loomShareUrl,
  thumbnailUrl,
  topic,
  subtopic,
  addedByName,
  createdAt,
  totalPlays,
  uniqueViewers,
  watchedAt,
  isCompleted,
  canManage,
  attachments,
  reactions,
  comments,
  currentUserId,
  isSuperAdmin,
}: {
  id: string;
  title: string;
  description: string | null;
  loomEmbedId: string;
  loomShareUrl: string;
  thumbnailUrl: string | null;
  topic: LearnTopic | null;
  subtopic: LearnSubtopic | null;
  addedByName: string;
  createdAt: string;
  totalPlays: number;
  uniqueViewers: number;
  watchedAt: string | null;
  isCompleted: boolean;
  canManage: boolean;
  attachments: VideoAttachment[];
  reactions: ReactionEntry[];
  comments: VideoComment[];
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const [, startTransition] = useTransition();

  const handleToggleCompleted = () => {
    // Optimistic flip. Fire-and-forget like recordPlay/toggleVideoReaction:
    // the happy path revalidates /learn and the local state already matches.
    // A failed write would leave this checkbox stale until a full reload,
    // which is an acceptable trade for these low-stakes per-user marks.
    setCompleted((c) => !c);
    const fd = new FormData();
    fd.set("video_id", id);
    startTransition(() => {
      void toggleVideoCompletion(fd);
    });
  };

  const handlePlay = () => {
    setPlaying(true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("video_id", id);
      void recordPlay(fd);
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      void deleteVideo(fd);
    });
  };

  const showResources = attachments.length > 0 || canManage;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-video w-full bg-muted">
        {watchedAt && !playing && (
          <span
            className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm ring-1 ring-white"
            title={`Watched ${format(new Date(watchedAt), "d MMM yyyy")}`}
            aria-label={`Watched ${format(new Date(watchedAt), "d MMM yyyy")}`}
          >
            <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
            Watched
          </span>
        )}
        {playing ? (
          <iframe
            src={loomEmbedUrl(loomEmbedId, { autoplay: true })}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            className="group absolute inset-0 flex items-center justify-center overflow-hidden"
            aria-label={`Play ${title}`}
          >
            {thumbnailUrl && !thumbFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                aria-hidden
                onError={() => setThumbFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />
            <span className="relative flex size-12 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:scale-105">
              <PlayIcon className="size-5 translate-x-px" />
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-foreground">
            {title}
          </h3>
          {canManage && (
            <div className="flex shrink-0 items-center gap-1.5">
              <EditVideoDialog
                id={id}
                title={title}
                description={description}
                loomShareUrl={loomShareUrl}
                topic={topic}
                subtopic={subtopic}
              />
              <button
                type="button"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-red-600"
                aria-label="Delete video"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={handleToggleCompleted}
            aria-pressed={completed}
            className={`inline-flex items-center gap-2 text-xs font-medium transition-colors ${
              completed
                ? "text-emerald-700"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              aria-hidden
              className={`flex size-4 items-center justify-center rounded border transition-colors ${
                completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-input bg-background"
              }`}
            >
              {completed && <CheckIcon className="size-3" strokeWidth={3} />}
            </span>
            {completed ? "Completed" : "Mark as completed"}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
          <span>
            {totalPlays} {totalPlays === 1 ? "play" : "plays"}
            <span aria-hidden className="mx-1.5 text-muted-foreground/50">
              ·
            </span>
            {uniqueViewers} {uniqueViewers === 1 ? "viewer" : "viewers"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {addedByName}
          <span aria-hidden className="mx-1.5 text-muted-foreground/50">
            ·
          </span>
          {format(new Date(createdAt), "d MMM yyyy")}
        </div>
      </div>

      {showResources && (
        <div className="border-t border-border bg-background px-4 py-3">
          <ResourcesSection
            videoId={id}
            videoTitle={title}
            attachments={attachments}
            canManage={canManage}
          />
        </div>
      )}

      <div className="space-y-3 border-t border-border bg-background px-4 py-3">
        <Reactions
          videoId={id}
          currentUserId={currentUserId}
          reactions={reactions}
        />
        <Comments
          videoId={id}
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
          comments={comments}
        />
      </div>
    </article>
  );
}

function ResourcesSection({
  videoId,
  videoTitle,
  attachments,
  canManage,
}: {
  videoId: string;
  videoTitle: string;
  attachments: VideoAttachment[];
  canManage: boolean;
}) {
  const count = attachments.length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          Resources
          {count > 0 && (
            <span className="ml-1.5 text-muted-foreground">({count})</span>
          )}
        </span>
        {canManage && (
          <AddAttachmentDialog
            videoId={videoId}
            videoTitle={videoTitle}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <PlusIcon className="size-3.5" />
                Add
              </button>
            }
          />
        )}
      </div>
      {count > 0 ? (
        <ul className="space-y-0.5">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No resources attached yet.
        </p>
      )}
    </div>
  );
}

function AttachmentRow({
  attachment,
  canManage,
}: {
  attachment: VideoAttachment;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setError(null);
    startTransition(async () => {
      const res = await signedUrlForResource(attachment.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const handleDelete = () => {
    if (!confirm(`Remove "${attachment.title}"?`)) return;
    const fd = new FormData();
    fd.set("id", attachment.id);
    startTransition(() => {
      void deleteVideoResource(fd);
    });
  };

  return (
    <li className="group flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={handleOpen}
        disabled={pending}
        className="inline-flex min-w-0 flex-1 items-center gap-2 truncate rounded py-1 text-left text-foreground hover:underline disabled:opacity-50"
      >
        {attachment.kind === "url" ? (
          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{attachment.title}</span>
        {attachment.kind === "file" && attachment.fileSize != null && (
          <span className="shrink-0 text-muted-foreground">
            {formatBytes(attachment.fileSize)}
          </span>
        )}
      </button>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
          aria-label="Remove resource"
        >
          <TrashIcon className="size-3.5" />
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
