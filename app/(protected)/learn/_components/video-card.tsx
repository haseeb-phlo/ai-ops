"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { PlayIcon, ExternalLinkIcon, EyeIcon, TrashIcon } from "lucide-react";
import { loomEmbedUrl } from "@/lib/loom";
import { deleteVideo, recordPlay } from "../actions";

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
  canDelete,
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
  canDelete: boolean;
}) {
  const [playing, setPlaying] = useState(false);
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
            className="group absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/60 transition-colors hover:from-muted/80 hover:to-muted/40"
            aria-label={`Play ${title}`}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-foreground/90 text-background ring-4 ring-background/40 transition-transform group-hover:scale-105">
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
          {canDelete && (
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

