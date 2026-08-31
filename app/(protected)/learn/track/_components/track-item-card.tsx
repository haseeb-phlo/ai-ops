"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  CheckIcon,
  ClapperboardIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LockIcon,
  PlayIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { loomEmbedUrl } from "@/lib/loom";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  PROGRAMME_ITEM_STATE,
  PROGRAMME_SIGNOFF,
  type ProgrammeItemState,
  type ProgrammeSignoffStatus,
} from "@/lib/status";
import type { TrackVideo } from "@/lib/programme/track-data";
import { markTrackItemComplete, markTrackItemStarted } from "../actions";
import { SubmissionDialog } from "./submission-dialog";

export type TrackItemView = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  state: ProgrammeItemState;
  unlockDate: string;
  video: TrackVideo | null;
  /** Set for submission_slot items. */
  /** Video day with nothing recorded yet: shown, but not a to-do. */
  awaitingVideo?: boolean;
  /**
   * Whether this item's own day has come round yet.
   *
   * Distinct from `state`, and only because unlock is weekly: on the Monday
   * every day of the week is "available", so being open says nothing about
   * whether it is today's. Drives the still frame - see below.
   */
  dayArrived?: boolean;
  submission?: {
    kind: string;
    signoffStatus: ProgrammeSignoffStatus | null;
    signoffComment: string | null;
    reviewedByAi?: boolean;
  } | null;
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
export function TrackItemCard({
  cohortId,
  item,
}: {
  /**
   * The cohort this card is being shown for, sent with every write and every
   * link out. An admin with a preview run is in two cohorts on the same track,
   * and without this the server picks one for itself - which is how a sandbox
   * submission gets filed against a real cohort.
   */
  cohortId: string;
  item: TrackItemView;
}) {
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
  // A video day with nothing linked yet can't be completed: otherwise G1 is
  // satisfiable for content that hasn't been recorded. Use examples have no
  // video by design, so they stay completable.
  const awaitingVideo = item.awaitingVideo ?? (item.type === "video" && !item.video);
  // Defaults to true so any caller that hasn't been taught about day pacing
  // keeps the old behaviour rather than silently losing every thumbnail.
  const showThumbnail =
    Boolean(item.video?.thumbnail_url) && (item.dayArrived ?? true);
  const canComplete =
    !locked &&
    !optimisticComplete &&
    !awaitingVideo &&
    (item.type === "video" || item.type === "use_example");

  const handlePlay = () => {
    setPlaying(true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      fd.set("cohort_id", cohortId);
      void markTrackItemStarted(fd);
    });
  };

  const handleComplete = () => {
    setError(null);
    setOptimisticComplete(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("track_item_id", item.id);
      fd.set("cohort_id", cohortId);
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
              ? "bg-background"
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
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  awaitingVideo
                    ? "bg-muted-foreground/30"
                    : style.dotClassName,
                )}
              />
              {locked
                ? `Unlocks ${format(new Date(`${item.unlockDate}T00:00:00`), "d MMM")}`
                : awaitingVideo
                  ? "Coming soon"
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
                  {/* Still frame only once the day has come round. Weekly
                      unlock opens all five days on the Monday, so without
                      this the whole week's thumbnails sit on screen at once
                      and day one stops looking like day one. The video is
                      still playable - working ahead is allowed, it just is
                      not advertised. */}
                  {showThumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.video.thumbnail_url!}
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

          {/* Placeholder for a day whose video isn't recorded yet. Member-
              facing copy, not the admin instruction it used to show - during
              Cohort 1 several days are still in production, and "coming soon"
              with the topic named reads as planned rather than broken. */}
          {!locked && !item.video && item.type === "video" && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
              >
                <ClapperboardIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Video coming soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Being recorded now. It will not hold up your progress - carry
                  on with the rest of the day.
                </p>
              </div>
            </div>
          )}

          {!locked && item.type === "submission_slot" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {item.submission?.signoffStatus && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      PROGRAMME_SIGNOFF[item.submission.signoffStatus]
                        .dotClassName,
                    )}
                  />
                  {PROGRAMME_SIGNOFF[item.submission.signoffStatus].label}
                </span>
              )}
              {item.submission?.signoffStatus !== "approved" && (
                <SubmissionDialog
                  cohortId={cohortId}
                  trackItemId={item.id}
                  title={item.title}
                  kind={item.submission?.kind ?? "signed_example"}
                  isResubmission={item.submission?.signoffStatus === "rejected"}
                  rejectionComment={item.submission?.signoffComment ?? null}
                />
              )}
            </div>
          )}

          {!locked && item.type === "quiz" && (
            <Link
              href={`/learn/track/quiz/${item.id}?cohort=${cohortId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
            >
              {item.state === "complete" ? "Retake" : "Start"} the check
            </Link>
          )}

          {!locked &&
            (item.type === "questionnaire_baseline" ||
              item.type === "questionnaire_post") && (
              <Link
                href={`/learn/track/score?cohort=${cohortId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
              >
                {item.state === "complete" ? "See your score" : "Open the check-in"}
              </Link>
            )}

          {/* Feedback on an APPROVED submission had nowhere to appear: the
              resubmit dialog only opens when something was sent back, so an
              approving comment was written and never read. */}
          {!locked &&
            item.type === "submission_slot" &&
            item.submission?.signoffStatus === "approved" &&
            item.submission.signoffComment && (
              <div className="mt-2 rounded-md border border-border border-l-2 border-l-success bg-background px-3 py-2">
                <p className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {item.submission.reviewedByAi
                    ? "Feedback - automatic review"
                    : "Feedback"}
                </p>
                <p className="mt-0.5 text-xs text-foreground">
                  {item.submission.signoffComment}
                </p>
              </div>
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
