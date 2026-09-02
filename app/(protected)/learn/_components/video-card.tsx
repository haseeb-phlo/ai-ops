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
  ExternalLinkIcon,
} from "lucide-react";
import { videoEmbedUrl } from "@/lib/video";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export type VideoAttachment = {
  id: string;
  kind: "url" | "file";
  title: string;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
};

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * The still frame, and the one control on it.
 *
 * Two shapes, one set of styles: `play` swaps the frame for an iframe in
 * place, `open` is an anchor to the host. They were briefly inline ternaries
 * around the same markup, which is how a link-out card ends up with a
 * different hover state from a playable one.
 */
function VideoPoster(
  props: {
    title: string;
    thumbnailUrl: string | null;
    onThumbnailError: () => void;
  } & (
    | { kind: "play"; onPlay: () => void }
    | { kind: "open"; href: string; onOpen: () => void }
  ),
) {
  const shell =
    "group absolute inset-0 flex items-center justify-center overflow-hidden";
  const inner = (
    <>
      {props.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.thumbnailUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={props.onThumbnailError}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />
      <span className="relative flex size-12 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:scale-105">
        {props.kind === "play" ? (
          <PlayIcon className="size-5 translate-x-px" />
        ) : (
          <ExternalLinkIcon className="size-5" />
        )}
      </span>
    </>
  );

  return props.kind === "play" ? (
    <button
      type="button"
      onClick={props.onPlay}
      className={shell}
      aria-label={`Play ${props.title}`}
    >
      {inner}
    </button>
  ) : (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={props.onOpen}
      className={shell}
      aria-label={`Open ${props.title} in a new tab`}
    >
      {inner}
    </a>
  );
}

export function VideoCard({
  id,
  title,
  description,
  provider,
  embedId,
  shareUrl,
  thumbnailUrl,
  topic,
  subtopic,
  durationSeconds,
  totalPlays,
  uniqueViewers,
  watchedAt,
  isCompleted,
  canManage,
  attachments,
}: {
  id: string;
  title: string;
  description: string | null;
  /** Which host this lives on - see lib/video.ts. */
  provider: string;
  /** Null for provider="link", which has no embed and opens in a new tab. */
  embedId: string | null;
  shareUrl: string;
  thumbnailUrl: string | null;
  topic: LearnTopic | null;
  subtopic: LearnSubtopic | null;
  durationSeconds: number | null;
  totalPlays: number;
  uniqueViewers: number;
  watchedAt: string | null;
  isCompleted: boolean;
  canManage: boolean;
  attachments: VideoAttachment[];
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [, startTransition] = useTransition();

  const handleToggleCompleted = () => {
    // Optimistic flip; on failure we revert and surface a small inline
    // error instead of leaving the checkbox silently stale.
    setCompletionError(null);
    setCompleted((c) => !c);
    const fd = new FormData();
    fd.set("video_id", id);
    startTransition(async () => {
      const result = await toggleVideoCompletion(fd);
      if (result.kind === "error") {
        setCompleted((c) => !c);
        setCompletionError(result.message);
      }
    });
  };

  // Null for a host we cannot embed, which is what turns the poster into a
  // link out. Branching on this rather than on `embedId` being truthy is
  // deliberate: reaching for the id directly is how you end up with an iframe
  // pointed at a URL built from the string "null".
  const embedUrl = videoEmbedUrl({ provider, embedId }, { autoplay: true });

  const recordThePlay = () => {
    startTransition(() => {
      const fd = new FormData();
      fd.set("video_id", id);
      void recordPlay(fd);
    });
  };

  const handlePlay = () => {
    setPlaying(true);
    recordThePlay();
  };

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      void deleteVideo(fd);
    });
  };

  const showResources = attachments.length > 0 || canManage;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-video w-full bg-muted">
        {watchedAt && !playing && (
          <Badge
            variant="secondary"
            className="pointer-events-none absolute right-2 top-2 z-10 shadow-sm"
            title={`Started ${format(new Date(watchedAt), "d MMM yyyy")}`}
            aria-label={`Started ${format(new Date(watchedAt), "d MMM yyyy")}`}
          >
            <PlayIcon aria-hidden />
            Started
          </Badge>
        )}
        {durationSeconds != null && !playing && (
          <span
            className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-black/70 px-1.5 py-0.5 font-mono text-3xs tabular-nums text-white"
            aria-label={`Duration ${formatDuration(durationSeconds)}`}
          >
            {formatDuration(durationSeconds)}
          </span>
        )}
        {playing && embedUrl ? (
          <iframe
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : (
          <VideoPoster
            title={title}
            thumbnailUrl={thumbnailUrl && !thumbFailed ? thumbnailUrl : null}
            onThumbnailError={() => setThumbFailed(true)}
            // A real anchor when there is nothing to embed, so middle-click
            // and "open in new tab" work and the play triangle becomes an
            // external-link mark rather than promising something that will
            // not happen in place. The play is recorded either way.
            {...(embedUrl
              ? { kind: "play" as const, onPlay: handlePlay }
              : {
                  kind: "open" as const,
                  href: shareUrl,
                  onOpen: recordThePlay,
                })}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5">
            <CompletionToggle
              completed={completed}
              onToggle={handleToggleCompleted}
            />
            {canManage &&
              (confirmingDelete ? (
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    Confirm delete?
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <>
                  <EditVideoDialog
                    id={id}
                    title={title}
                    description={description}
                    shareUrl={shareUrl}
                    topic={topic}
                    subtopic={subtopic}
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    aria-label={`Delete ${title}`}
                    title="Delete video"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </>
              ))}
          </div>
        </div>

        {completionError && (
          <p role="alert" className="text-xs text-destructive">
            {completionError}
          </p>
        )}

        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        <div className="mt-auto pt-3 text-xs text-muted-foreground tabular-nums">
          {totalPlays} {totalPlays === 1 ? "play" : "plays"}
          <span aria-hidden className="mx-1.5 text-muted-foreground/50">
            ·
          </span>
          {uniqueViewers} {uniqueViewers === 1 ? "viewer" : "viewers"}
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
    </article>
  );
}

// A compact tick-to-complete control, sat at the end of the title row so it
// reads like a checklist item (Things/Todoist/Linear) and stays reachable
// while the video is playing - the card body persists behind the iframe.
// The circle is visible at rest (muted ring) so the affordance is
// discoverable without hover; the check fills in when complete. Padding
// gives it a ≥28px effective hit area for touch.
function CompletionToggle({
  completed,
  onToggle,
}: {
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={completed}
      title={completed ? "Completed - click to unmark" : "Mark as completed"}
      className="inline-flex shrink-0 items-center justify-center rounded-full p-1"
    >
      <span
        aria-hidden
        className={`inline-flex size-5 items-center justify-center rounded-full border transition-colors ${
          completed
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 text-transparent hover:border-primary"
        }`}
      >
        <CheckIcon className={completed ? "size-3" : "hidden"} strokeWidth={3} />
      </span>
      <span className="sr-only">
        {completed ? "Mark as not completed" : "Mark as completed"}
      </span>
    </button>
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
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
  const [confirming, setConfirming] = useState(false);

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
    const fd = new FormData();
    fd.set("id", attachment.id);
    startTransition(() => {
      void deleteVideoResource(fd);
    });
  };

  return (
    <li className="text-xs">
      <div className="flex items-center gap-2">
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
        {canManage &&
          (confirming ? (
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-muted-foreground">Confirm delete?</span>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                loading={pending}
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
              aria-label={`Remove ${attachment.title}`}
              title="Remove resource"
            >
              <TrashIcon className="size-3.5" />
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="mt-0.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
