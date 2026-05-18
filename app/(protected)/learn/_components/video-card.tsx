"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  PlayIcon,
  ExternalLinkIcon,
  EyeIcon,
  TrashIcon,
  PaperclipIcon,
  FileIcon,
  LinkIcon,
} from "lucide-react";
import { loomEmbedUrl, loomThumbnailUrl } from "@/lib/loom";
import {
  deleteVideo,
  deleteVideoResource,
  recordPlay,
  signedUrlForResource,
} from "../actions";
import { AddAttachmentDialog } from "./add-attachment-dialog";

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
  addedByName,
  createdAt,
  totalPlays,
  uniqueViewers,
  canManage,
  attachments,
}: {
  id: string;
  title: string;
  description: string | null;
  loomEmbedId: string;
  loomShareUrl: string;
  addedByName: string;
  createdAt: string;
  totalPlays: number;
  uniqueViewers: number;
  canManage: boolean;
  attachments: VideoAttachment[];
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [, startTransition] = useTransition();

  const handlePlay = () => {
    setPlaying(true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("video_id", id);
      // Fire-and-forget; the iframe loads regardless of whether the play row
      // lands. revalidatePath inside the action refreshes the counts on the
      // next navigation/render.
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

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-video w-full bg-muted">
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
            className="group absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-muted to-muted/60 transition-colors hover:from-muted/80 hover:to-muted/40"
            aria-label={`Play ${title}`}
          >
            {!thumbFailed && (
              // Loom CDN thumbnails - plain <img> avoids needing remotePatterns
              // config and the onError handler hides it if the URL 404s for an
              // older video so the gradient still shows through.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loomThumbnailUrl(loomEmbedId)}
                alt=""
                aria-hidden
                onError={() => setThumbFailed(true)}
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            )}
            <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/25" />
            <span className="relative flex size-14 items-center justify-center rounded-full bg-foreground/90 text-background ring-4 ring-background/40 transition-transform group-hover:scale-105">
              <PlayIcon className="size-6 translate-x-[1px]" />
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
            <button
              type="button"
              onClick={handleDelete}
              className="shrink-0 text-muted-foreground hover:text-red-600"
              aria-label="Delete video"
              title="Delete video"
            >
              <TrashIcon className="size-3.5" />
            </button>
          )}
        </div>

        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}

        <AttachmentsBlock
          videoId={id}
          videoTitle={title}
          attachments={attachments}
          canManage={canManage}
        />

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] text-muted-foreground">
          <span title="Plays from unique viewers">
            <EyeIcon className="mr-1 inline size-3 -translate-y-px" />
            {totalPlays} {totalPlays === 1 ? "play" : "plays"} from{" "}
            {uniqueViewers} {uniqueViewers === 1 ? "person" : "people"}
          </span>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span>
            Added by{" "}
            <span className="text-foreground">{addedByName}</span>
          </span>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span>{format(new Date(createdAt), "d MMM yyyy")}</span>
          <a
            href={loomShareUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Open in Loom"
          >
            <ExternalLinkIcon className="size-3" />
            Loom
          </a>
        </div>
      </div>
    </article>
  );
}

function AttachmentsBlock({
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
  if (attachments.length === 0 && !canManage) return null;
  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-border/70 bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <PaperclipIcon className="size-3" />
          Attachments
        </span>
        {canManage && (
          <AddAttachmentDialog videoId={videoId} videoTitle={videoTitle} />
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No attachments yet.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} canManage={canManage} />
          ))}
        </ul>
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

  const label =
    attachment.kind === "file" && attachment.fileSize != null
      ? `${attachment.title} (${formatBytes(attachment.fileSize)})`
      : attachment.title;

  return (
    <li className="flex items-center gap-1.5 text-xs">
      <button
        type="button"
        onClick={handleOpen}
        disabled={pending}
        className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-foreground hover:bg-background hover:underline disabled:opacity-50"
        title={attachment.kind === "url" && attachment.url ? attachment.url : label}
      >
        {attachment.kind === "url" ? (
          <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <FileIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{label}</span>
      </button>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="shrink-0 text-muted-foreground hover:text-red-600 disabled:opacity-50"
          aria-label="Remove attachment"
          title="Remove attachment"
        >
          <TrashIcon className="size-3" />
        </button>
      )}
      {error && (
        <span role="alert" className="text-[10px] text-red-600">
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
