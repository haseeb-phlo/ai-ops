"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  CheckIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LockIcon,
  PlayIcon,
  UsersIcon,
} from "lucide-react";
import { loomEmbedUrl } from "@/lib/loom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PROGRAMME_ITEM_STATE, type ProgrammeItemState } from "@/lib/status";
import type { TrackVideo } from "@/lib/programme/track-data";
import { markTrackItemComplete, markTrackItemStarted } from "../actions";

export type TrackItemView = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  state: ProgrammeItemState;
  unlockDate: string;
  video: TrackVideo | null;
};

const TYPE_ICON: Record<string, typeof PlayIcon> = {
  video: PlayIcon,
  use_example: FileTextIcon,
  session: UsersIcon,
  quiz: ClipboardCheckIcon,
  questionnaire_baseline: ClipboardCheckIcon,
  questionnaire_post: ClipboardCheckIcon,
  submission_slot: FileTextIcon,
};

/**
 * One item on the timeline.
 *
 * Locked items still render - greyed, with their unlock date - because seeing
 * what's coming is most of what makes a 15-day programme feel finite.
 */
export function TrackItemCard({ item }: { item: TrackItemView }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticComplete, setOptimisticComplete] = useState(
    item.state === "complete",
  );
  const [pending, startTransition] = useTransition();

  const locked = item.state === "locked";
  const Icon = TYPE_ICON[item.type] ?? FileTextIcon;
  const state: ProgrammeItemState = optimisticComplete ? "complete" : item.state;
  const style = PROGRAMME_ITEM_STATE[state];
  const canComplete =
    !locked && !optimisticComplete && (item.type === "video" || item.type === "use_example");

  const handlePlay = () => {
    setPlaying(true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      void markTrackItemStarted(fd);
    });
  };

  const handleComplete = () => {
    setError(null);
    setOptimisticComplete(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      const result = await markTrackItemComplete(fd);
      if (result.kind === "error") {
        setOptimisticComplete(false);
        setError(result.message);
      }
    });
  };

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-background p-4",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border",
            state === "complete"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {locked ? (
            <LockIcon className="size-3.5" />
          ) : state === "complete" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", style.dotClassName)}
              />
              {locked
                ? `Unlocks ${format(new Date(`${item.unlockDate}T00:00:00`), "d MMM")}`
                : style.label}
            </span>
          </div>

          {item.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}

          {!locked && item.video && (
            <div className="mt-3">
              {playing ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <iframe
                    src={loomEmbedUrl(item.video.loom_embed_id, {
                      autoplay: true,
                    })}
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={item.video.title}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePlay}
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted"
                  aria-label={`Play ${item.video.title}`}
                >
                  {item.video.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.video.thumbnail_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="relative flex size-11 items-center justify-center rounded-full bg-black/70 text-white transition group-hover:bg-black/85">
                    <PlayIcon className="size-5" aria-hidden />
                  </span>
                </button>
              )}
            </div>
          )}

          {!locked && !item.video && (item.type === "video" || item.type === "use_example") && (
            <p className="mt-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              This day&apos;s video hasn&apos;t been linked yet — an admin can
              attach it from the Learn library.
            </p>
          )}

          {canComplete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleComplete}
              disabled={pending}
            >
              <CheckIcon aria-hidden />
              Mark complete
            </Button>
          )}

          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
